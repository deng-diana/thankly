"""
认证路由
处理 Apple 和 Google 登录

这个文件负责：
- Apple 登录
- Google 登录
- Token 验证和交换

生产环境实现：
1. 使用 boto3 调用 AWS Cognito API
2. 创建或获取用户
3. 返回真实的 Cognito tokens
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Dict, Optional
import boto3
import json
from jose import jwt
from botocore.exceptions import ClientError
import uuid
from datetime import datetime
from ..utils.cognito_auth import get_current_user

# 创建路由器
router = APIRouter()

# AWS Cognito 配置
COGNITO_USER_POOL_ID = "us-east-1_1DgDNffb0"
COGNITO_CLIENT_ID = "6e521vvi1g2a1efbf3l70o83k2"
COGNITO_REGION = "us-east-1"

# 创建 Cognito 客户端
cognito_client = boto3.client('cognito-idp', region_name=COGNITO_REGION)


class AppleLoginRequest(BaseModel):
    """Apple 登录请求"""
    identityToken: str  # Apple 的 identity token


class AuthResponse(BaseModel):
    """认证响应"""
    accessToken: str  # Cognito Access Token
    idToken: str  # Cognito ID Token
    refreshToken: str  # Cognito Refresh Token
    picture: Optional[str] = None  # ← 新增头像URL


@router.post("/apple", response_model=AuthResponse, summary="Apple 登录")
async def apple_login(request: AppleLoginRequest):
    """
    Apple 登录端点
    
    流程：
    1. 接收 Apple 的 identity token
    2. 验证 token 的有效性
    3. 用 Apple token 换取 Cognito tokens
    4. 返回 Cognito tokens 给前端
    """
    try:
        print(f"🍎 开始处理 Apple 登录...")
        
        # 1. 验证并解析 Apple token
        apple_token = request.identityToken
        decoded_token = verify_apple_token(apple_token)
        
        if not decoded_token:
            raise HTTPException(status_code=401, detail="无效的 Apple token")
        
        print(f"✅ Apple token 验证成功")
        
        # 2. 使用 Apple token 创建或获取 Cognito 用户
        cognito_tokens = exchange_apple_for_cognito(apple_token)
        
        print(f"✅ Cognito tokens 获取成功")
        
        return cognito_tokens
        
    except Exception as e:
        print(f"❌ Apple 登录失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Apple 登录失败: {str(e)}")


def verify_apple_token(token: str) -> Optional[Dict]:
    """
    验证 Apple 的 identity token
    """
    try:
        # 检查token格式
        if not token or len(token.split('.')) != 3:
            print(f"Token格式错误: {token[:50]}...")
            return None
        
        # 解码 token（不验证签名，只是看看内容）
        decoded = jwt.get_unverified_claims(token)
        print(f"Token解码成功: {decoded}")
        
        # 验证必要的字段
        if 'sub' not in decoded:
            print("Token缺少sub字段")
            return None
        
        return decoded
        
    except Exception as e:
        print(f"Token 验证失败: {str(e)}")
        print(f"Token内容: {token[:100]}...")
        return None


def exchange_apple_for_cognito(apple_token: str) -> AuthResponse:
    """
    用 Apple token 换取 Cognito tokens - 生产环境实现
    
    AWS Cognito 处理 Apple 登录的标准流程：
    1. 先创建或获取用户
    2. 使用 PRESIGNED_URL 方式（兼容 SRP）或 ADMIN_NO_SRP_AUTH
    
    重要：你的 Cognito App Client 启用了 SRP，但我们用管理员 API 可以绕过 SRP
    """
    try:
        # 解码 Apple token 获取用户信息
        decoded = jwt.get_unverified_claims(apple_token)
        apple_sub = decoded.get('sub')  # Apple 用户 ID
        email = decoded.get('email')
        
        # 使用邮箱作为用户名，如果没有邮箱则使用Apple sub
        if email:
            username = email
        else:
            # 如果没有邮箱，使用Apple sub但格式化为邮箱格式
            # 确保Apple sub是有效的邮箱格式
            if '@' in apple_sub:
                username = apple_sub
            else:
                username = f"{apple_sub}@apple.local"
        
        print(f"🔍 使用的用户名: {username}")
        print(f"🔍 Apple sub: {apple_sub}")
        print(f"🔍 Email: {email}")
        
        # 先尝试创建用户（如果已存在会报错，我们忽略）
        try:
            # 构建用户属性列表，过滤掉None值
            user_attributes = []
            if email:
                user_attributes.extend([
                    {'Name': 'email', 'Value': email},
                    {'Name': 'email_verified', 'Value': 'true'}
                ])
            
            cognito_client.admin_create_user(
                UserPoolId=COGNITO_USER_POOL_ID,
                Username=username,
                UserAttributes=user_attributes,
                MessageAction='SUPPRESS',
                DesiredDeliveryMediums=[]
            )
        except ClientError as e:
            if e.response['Error']['Code'] == 'UsernameExistsException':
                pass  # 用户已存在，继续认证
            else:
                raise
        
        # 先设置临时密码（必须先设置才能用 ADMIN_NO_SRP_AUTH）
        try:
            # 生成一个临时密码（Apple token 的一部分）
            temp_password = apple_token[-32:] + "aA1!"  # 确保符合密码策略
            
            cognito_client.admin_set_user_password(
                UserPoolId=COGNITO_USER_POOL_ID,
                Username=username,
                Password=temp_password,
                Permanent=False  # 临时密码，需要立即修改
            )
        except ClientError as e:
            # 可能已设置过，忽略
            pass
        
        # 现在使用 ADMIN_USER_PASSWORD_AUTH 进行认证
        try:
            response = cognito_client.admin_initiate_auth(
                UserPoolId=COGNITO_USER_POOL_ID,
                ClientId=COGNITO_CLIENT_ID,
                AuthFlow='ADMIN_USER_PASSWORD_AUTH',  # 管理员用户密码认证流程
                AuthParameters={
                    'USERNAME': username,
                    'PASSWORD': temp_password
                }
            )
            
            # 检查响应结构
            if 'AuthenticationResult' in response:
                tokens = response['AuthenticationResult']
            elif 'ChallengeName' in response:
                challenge_name = response['ChallengeName']
                
                if challenge_name == 'NEW_PASSWORD_REQUIRED':
                    # 处理新密码挑战
                    session = response['Session']
                    challenge_params = response['ChallengeParameters']
                    
                    # 设置新密码（使用相同的临时密码）
                    cognito_client.admin_respond_to_auth_challenge(
                        UserPoolId=COGNITO_USER_POOL_ID,
                        ClientId=COGNITO_CLIENT_ID,
                        ChallengeName='NEW_PASSWORD_REQUIRED',
                        Session=session,
                        ChallengeResponses={
                            'USERNAME': username,
                            'NEW_PASSWORD': temp_password,
                            'userAttributes.name': email.split('@')[0] if email else 'Apple User'  # 提供name属性
                        }
                    )
                    
                    # 重新尝试认证
                    response = cognito_client.admin_initiate_auth(
                        UserPoolId=COGNITO_USER_POOL_ID,
                        ClientId=COGNITO_CLIENT_ID,
                        AuthFlow='ADMIN_USER_PASSWORD_AUTH',
                        AuthParameters={
                            'USERNAME': username,
                            'PASSWORD': temp_password
                        }
                    )
                    
                    if 'AuthenticationResult' in response:
                        tokens = response['AuthenticationResult']
                    else:
                        raise HTTPException(status_code=500, detail="设置新密码后认证失败")
                else:
                    raise HTTPException(status_code=401, detail=f"不支持的挑战类型: {challenge_name}")
            else:
                raise HTTPException(status_code=500, detail="认证响应格式错误")
            
            
            return AuthResponse(
                accessToken=tokens['AccessToken'],
                idToken=tokens['IdToken'],
                refreshToken=tokens['RefreshToken']
            )
            
        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']
            raise HTTPException(status_code=401, detail=f"认证失败: {error_message}")
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        error_message = e.response['Error']['Message']
        raise HTTPException(status_code=500, detail=f"AWS 错误: {error_message}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取 tokens 失败: {str(e)}")


class RefreshTokenRequest(BaseModel):
    """刷新Token请求"""
    refreshToken: str


class GooglePictureRequest(BaseModel):
    """Google头像请求"""
    googleUserId: str
    email: str


@router.post("/refresh", summary="刷新Token")
async def refresh_token(request: RefreshTokenRequest):
    """
    用refresh token换新的access token
    增强版：带重试和详细日志
    """
    try:
        print(f"🔄 收到刷新请求")
        print(f"🔍 RefreshToken长度: {len(request.refreshToken)}")
        
        # 验证refreshToken格式
        if not request.refreshToken or len(request.refreshToken) < 20:
            print(f"❌ RefreshToken格式无效")
            raise HTTPException(status_code=400, detail="RefreshToken格式无效")
        
        # 调用AWS Cognito刷新（带重试）
        max_retries = 2
        last_error = None
        
        for attempt in range(1, max_retries + 1):
            try:
                print(f"🔄 Cognito刷新尝试 {attempt}/{max_retries}")
                
                response = cognito_client.initiate_auth(
                    ClientId=COGNITO_CLIENT_ID,
                    AuthFlow='REFRESH_TOKEN_AUTH',
                    AuthParameters={
                        'REFRESH_TOKEN': request.refreshToken
                    }
                )
                
                # 成功获取tokens
                if 'AuthenticationResult' in response:
                    tokens = response['AuthenticationResult']
                    
                    print(f"✅ 刷新成功")
                    print(f"📦 返回tokens: AccessToken={bool(tokens.get('AccessToken'))}, IdToken={bool(tokens.get('IdToken'))}")
                    
                    return {
                        "accessToken": tokens['AccessToken'],
                        "idToken": tokens['IdToken'],
                        "refreshToken": request.refreshToken  # 保持原refreshToken
                    }
                else:
                    print(f"⚠️ 响应中没有AuthenticationResult: {response}")
                    raise Exception("响应格式错误")
                    
            except ClientError as ce:
                error_code = ce.response['Error']['Code']
                error_msg = ce.response['Error']['Message']
                
                print(f"⚠️ Cognito错误 [{error_code}]: {error_msg}")
                
                # 不可重试的错误
                if error_code in ['NotAuthorizedException', 'UserNotFoundException']:
                    print(f"❌ RefreshToken已过期或无效")
                    raise HTTPException(status_code=401, detail="登录已过期")
                
                # 可重试的错误（如网络问题、限流等）
                last_error = ce
                if attempt < max_retries:
                    print(f"⏳ 等待{attempt}秒后重试...")
                    import time
                    time.sleep(attempt)
                    continue
                    
            except Exception as e:
                print(f"⚠️ 刷新异常: {str(e)}")
                last_error = e
                if attempt < max_retries:
                    import time
                    time.sleep(attempt)
                    continue
        
        # 所有重试都失败
        print(f"❌ 刷新失败（已重试{max_retries}次）: {last_error}")
        raise HTTPException(status_code=500, detail="服务暂时不可用，请稍后重试")
        
    except HTTPException:
        # 已经是HTTPException，直接抛出
        raise
    except ClientError as e:
        error_code = e.response['Error']['Code']
        error_msg = e.response['Error']['Message']
        print(f"❌ Cognito错误: [{error_code}] {error_msg}")
        raise HTTPException(status_code=401, detail="登录已过期")
    except Exception as e:
        print(f"❌ 未知错误: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="服务错误")


@router.post("/google/picture", summary="获取Google头像")
async def get_google_picture(request: GooglePictureRequest):
    """
    获取Google用户头像
    
    通过Google People API获取用户的真实头像
    """
    try:
        print(f"🖼️ 开始获取Google头像: {request.email}")
        
        google_user_id = request.googleUserId
        email = request.email
        
        # 方法1: 使用Google的公开头像URL格式
        # 这个URL通常能获取到用户的真实头像
        picture_url = f"https://www.googleapis.com/plus/v1/people/{google_user_id}/image"
        
        print(f"🔗 构建的头像URL: {picture_url}")
        
        # 验证URL是否可访问（可选）
        try:
            import requests
            response = requests.head(picture_url, timeout=5)
            if response.status_code == 200:
                print(f"✅ 头像URL可访问")
            else:
                print(f"⚠️ 头像URL返回状态码: {response.status_code}")
        except Exception as e:
            print(f"⚠️ 头像URL验证失败: {e}")
        
        return {
            "picture": picture_url,
            "googleUserId": google_user_id,
            "email": email
        }
        
    except Exception as e:
        print(f"❌ 获取Google头像失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取Google头像失败: {str(e)}")


class UsernamePasswordLoginRequest(BaseModel):
    """用户名密码登录请求"""
    username: str
    password: str


class SignUpRequest(BaseModel):
    """注册请求"""
    username: str
    email: str
    password: str


class PhoneSignUpRequest(BaseModel):
    """手机号注册请求"""
    phone_number: str  # 手机号，格式：+8613800138000
    name: Optional[str] = None  # 用户姓名（可选，注册时使用）


class VerifyPhoneCodeRequest(BaseModel):
    """验证手机验证码请求"""
    phone_number: str
    verification_code: str


class EmailLoginOrSignUpRequest(BaseModel):
    """邮箱登录或注册请求"""
    email: str
    password: str
    name: Optional[str] = None  # 用户姓名（可选，注册时使用）


class EmailConfirmRequest(BaseModel):
    """邮箱确认请求"""
    email: str
    code: str
    password: str


class EmailLoginOrSignUpResponse(BaseModel):
    """邮箱登录或注册响应"""
    status: str  # 'SIGNED_IN', 'CONFIRMATION_REQUIRED', 'WRONG_PASSWORD'
    delivery: Optional[str] = None  # 'EMAIL' 当需要确认时
    accessToken: Optional[str] = None
    idToken: Optional[str] = None
    refreshToken: Optional[str] = None


@router.post("/email/login_or_signup", response_model=EmailLoginOrSignUpResponse, summary="邮箱登录或注册")
async def email_login_or_signup(request: EmailLoginOrSignUpRequest):
    """
    邮箱登录或注册端点（智能分支）
    
    流程：
    1. 先尝试登录（USER_PASSWORD_AUTH）
    2. 若 UserNotFoundException → 调用 SignUp 创建用户 → 返回 CONFIRMATION_REQUIRED
    3. 若 UserNotConfirmedException → 触发 ResendConfirmationCode → 返回 CONFIRMATION_REQUIRED
    4. 若 NotAuthorizedException → 返回 WRONG_PASSWORD
    5. 登录成功 → 返回 SIGNED_IN + tokens
    """
    try:
        print(f"📧 开始处理邮箱登录或注册: {request.email}")
        
        email = request.email
        password = request.password
        username = email  # 使用邮箱作为用户名
        
        # 1. 先检查用户是否存在（避免新用户被误判为密码错误）
        user_exists = False
        try:
            cognito_client.admin_get_user(
                UserPoolId=COGNITO_USER_POOL_ID,
                Username=username
            )
            user_exists = True
            print(f"✅ 用户已存在")
        except ClientError as get_user_error:
            error_code = get_user_error.response['Error']['Code']
            if error_code == 'UserNotFoundException':
                user_exists = False
                print(f"🆕 用户不存在，将进行注册")
            else:
                # 其他错误，记录并继续尝试登录流程
                print(f"⚠️ 检查用户存在性时出错: [{error_code}]，继续尝试登录流程")
                user_exists = None  # 未知状态，继续尝试登录
        
        # 2. 如果用户不存在，直接注册
        if user_exists is False:
            print(f"🆕 用户不存在，开始注册...")
            try:
                # 优先使用用户提供的姓名，如果没有则从邮箱提取
                user_name = request.name if request.name else (email.split('@')[0] if email else 'User')
                
                # 使用 sign_up 创建用户（会自动发送验证码到邮箱）
                # 注意：根据错误信息，用户的Cognito配置中没有name.formatted，所以我们使用name属性
                user_attributes = [
                    {'Name': 'email', 'Value': email}
                ]
                
                # 只有提供了姓名时才添加name属性（避免schema错误）
                if user_name:
                    user_attributes.append({'Name': 'name', 'Value': user_name})
                
                signup_response = cognito_client.sign_up(
                    ClientId=COGNITO_CLIENT_ID,
                    Username=username,
                    Password=password,
                    UserAttributes=user_attributes
                )
                
                print(f"✅ 用户注册成功，验证码已发送到邮箱")
                
                return EmailLoginOrSignUpResponse(
                    status='CONFIRMATION_REQUIRED',
                    delivery='EMAIL'
                )
                
            except ClientError as signup_error:
                signup_error_code = signup_error.response['Error']['Code']
                signup_error_message = signup_error.response['Error']['Message']
                
                print(f"❌ 注册失败: [{signup_error_code}] {signup_error_message}")
                
                if signup_error_code == 'UsernameExistsException':
                    # 用户已存在但可能未确认，尝试重发验证码
                    try:
                        cognito_client.resend_confirmation_code(
                            ClientId=COGNITO_CLIENT_ID,
                            Username=username
                        )
                        print(f"✅ 验证码已重新发送")
                        return EmailLoginOrSignUpResponse(
                            status='CONFIRMATION_REQUIRED',
                            delivery='EMAIL'
                        )
                    except Exception as resend_error:
                        raise HTTPException(status_code=400, detail=f"重新发送验证码失败: {str(resend_error)}")
                else:
                    raise HTTPException(status_code=400, detail=f"注册失败: {signup_error_message}")
        
        # 3. 如果用户存在，尝试登录
        try:
            # 使用管理员API，可以绕过客户端的SRP配置限制
            response = cognito_client.admin_initiate_auth(
                UserPoolId=COGNITO_USER_POOL_ID,
                ClientId=COGNITO_CLIENT_ID,
                AuthFlow='ADMIN_NO_SRP_AUTH',
                AuthParameters={
                    'USERNAME': username,
                    'PASSWORD': password
                }
            )
            
            if 'AuthenticationResult' in response:
                tokens = response['AuthenticationResult']
                print(f"✅ 登录成功")
                
                return EmailLoginOrSignUpResponse(
                    status='SIGNED_IN',
                    accessToken=tokens['AccessToken'],
                    idToken=tokens['IdToken'],
                    refreshToken=tokens['RefreshToken']
                )
            else:
                raise HTTPException(status_code=500, detail="登录响应异常")
                
        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']
            
            print(f"🔍 Cognito登录错误: [{error_code}] {error_message}")
            
            # 处理 UserNotConfirmedException - 用户存在但未确认
            if error_code == 'UserNotConfirmedException':
                print(f"📧 用户未确认，重新发送验证码...")
                
                try:
                    cognito_client.resend_confirmation_code(
                        ClientId=COGNITO_CLIENT_ID,
                        Username=username
                    )
                    
                    print(f"✅ 验证码已重新发送到邮箱")
                    
                    return EmailLoginOrSignUpResponse(
                        status='CONFIRMATION_REQUIRED',
                        delivery='EMAIL'
                    )
                    
                except ClientError as resend_error:
                    resend_error_code = resend_error.response['Error']['Code']
                    resend_error_message = resend_error.response['Error']['Message']
                    print(f"❌ 重发验证码失败: [{resend_error_code}] {resend_error_message}")
                    raise HTTPException(status_code=400, detail=f"重发验证码失败: {resend_error_message}")
            
            # 处理 NotAuthorizedException - 密码错误
            elif error_code == 'NotAuthorizedException':
                print(f"❌ 密码错误")
                return EmailLoginOrSignUpResponse(
                    status='WRONG_PASSWORD'
                )
            
            # 处理 UserNotFoundException - 理论上不应该到达这里（因为我们已经在前面检查过了），但作为兜底处理
            elif error_code == 'UserNotFoundException':
                print(f"⚠️ 用户不存在（理论上不应该到这里），尝试注册...")
                try:
                    # 优先使用用户提供的姓名，如果没有则从邮箱提取
                    user_name = request.name if request.name else (email.split('@')[0] if email else 'User')
                    
                    user_attributes = [
                        {'Name': 'email', 'Value': email}
                    ]
                    
                    # 只有提供了姓名时才添加name属性（避免schema错误）
                    if user_name:
                        user_attributes.append({'Name': 'name', 'Value': user_name})
                    
                    signup_response = cognito_client.sign_up(
                        ClientId=COGNITO_CLIENT_ID,
                        Username=username,
                        Password=password,
                        UserAttributes=user_attributes
                    )
                    print(f"✅ 用户注册成功，验证码已发送到邮箱")
                    return EmailLoginOrSignUpResponse(
                        status='CONFIRMATION_REQUIRED',
                        delivery='EMAIL'
                    )
                except ClientError as signup_error:
                    signup_error_code = signup_error.response['Error']['Code']
                    if signup_error_code == 'UsernameExistsException':
                        # 用户已存在但可能未确认，尝试重发验证码
                        try:
                            cognito_client.resend_confirmation_code(
                                ClientId=COGNITO_CLIENT_ID,
                                Username=username
                            )
                            return EmailLoginOrSignUpResponse(
                                status='CONFIRMATION_REQUIRED',
                                delivery='EMAIL'
                            )
                        except Exception:
                            raise HTTPException(status_code=400, detail="用户状态异常，请稍后重试")
                    else:
                        raise HTTPException(status_code=400, detail=f"注册失败: {signup_error.response['Error']['Message']}")
            
            # 其他错误
            else:
                print(f"❌ 未知错误: [{error_code}] {error_message}")
                raise HTTPException(status_code=401, detail=f"登录失败: {error_message}")
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ 邮箱登录或注册失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"操作失败: {str(e)}")


@router.post("/email/confirm", response_model=AuthResponse, summary="邮箱验证码确认并登录")
async def email_confirm(request: EmailConfirmRequest):
    """
    邮箱验证码确认端点
    
    流程：
    1. 调用 ConfirmSignUp 确认验证码
    2. 确认成功后立即执行登录，返回 tokens
    """
    try:
        print(f"📧 开始确认邮箱验证码: {request.email}")
        
        email = request.email
        code = request.code
        password = request.password
        username = email
        
        # 1. 确认验证码
        try:
            cognito_client.confirm_sign_up(
                ClientId=COGNITO_CLIENT_ID,
                Username=username,
                ConfirmationCode=code
            )
            print(f"✅ 验证码确认成功")
            
        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']
            
            print(f"❌ 验证码确认失败: [{error_code}] {error_message}")
            
            if error_code == 'CodeMismatchException':
                raise HTTPException(status_code=400, detail="验证码错误")
            elif error_code == 'ExpiredCodeException':
                raise HTTPException(status_code=400, detail="验证码已过期，请重新获取")
            elif error_code == 'NotAuthorizedException':
                raise HTTPException(status_code=400, detail="用户已确认或验证码无效")
            else:
                raise HTTPException(status_code=400, detail=f"确认失败: {error_message}")
        
        # 2. 确认后立即登录
        try:
            response = cognito_client.admin_initiate_auth(
                UserPoolId=COGNITO_USER_POOL_ID,
                ClientId=COGNITO_CLIENT_ID,
                AuthFlow='ADMIN_NO_SRP_AUTH',
                AuthParameters={
                    'USERNAME': username,
                    'PASSWORD': password
                }
            )
            
            if 'AuthenticationResult' in response:
                tokens = response['AuthenticationResult']
                print(f"✅ 确认并登录成功")
                
                return AuthResponse(
                    accessToken=tokens['AccessToken'],
                    idToken=tokens['IdToken'],
                    refreshToken=tokens['RefreshToken']
                )
            else:
                raise HTTPException(status_code=500, detail="登录失败")
                
        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']
            
            print(f"❌ 登录失败: [{error_code}] {error_message}")
            
            if error_code == 'NotAuthorizedException':
                raise HTTPException(status_code=401, detail="密码错误，请检查密码")
            else:
                raise HTTPException(status_code=401, detail=f"登录失败: {error_message}")
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ 邮箱确认失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"确认失败: {str(e)}")


@router.post("/username-password", response_model=AuthResponse, summary="用户名密码登录")
async def username_password_login(request: UsernamePasswordLoginRequest):
    """
    用户名密码登录端点
    
    流程：
    1. 使用ADMIN_NO_SRP_AUTH或SRP流程进行认证
    2. 返回Cognito tokens
    """
    try:
        print(f"🔐 开始处理用户名密码登录...")
        
        username = request.username
        password = request.password
        
        # 使用ADMIN_NO_SRP_AUTH流程（管理员API，绕过SRP）
        try:
            response = cognito_client.admin_initiate_auth(
                UserPoolId=COGNITO_USER_POOL_ID,
                ClientId=COGNITO_CLIENT_ID,
                AuthFlow='ADMIN_NO_SRP_AUTH',
                AuthParameters={
                    'USERNAME': username,
                    'PASSWORD': password
                }
            )
            
            if 'AuthenticationResult' in response:
                tokens = response['AuthenticationResult']
            elif 'ChallengeName' in response:
                # 处理挑战（如需要更改密码）
                raise HTTPException(status_code=401, detail="需要完成额外的验证步骤")
            else:
                raise HTTPException(status_code=401, detail="认证失败")
            
            print(f"✅ 用户名密码登录成功")
            
            return AuthResponse(
                accessToken=tokens['AccessToken'],
                idToken=tokens['IdToken'],
                refreshToken=tokens['RefreshToken']
            )
            
        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']
            
            print(f"❌ Cognito错误: [{error_code}] {error_message}")
            
            if error_code == 'NotAuthorizedException':
                raise HTTPException(status_code=401, detail="用户名或密码错误")
            elif error_code == 'UserNotFoundException':
                raise HTTPException(status_code=404, detail="用户不存在")
            else:
                raise HTTPException(status_code=401, detail=f"登录失败: {error_message}")
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ 用户名密码登录失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"登录失败: {str(e)}")


@router.post("/signup", response_model=AuthResponse, summary="注册新用户")
async def signup(request: SignUpRequest):
    """
    注册新用户端点
    
    流程：
    1. 在Cognito中创建用户
    2. 设置密码
    3. 自动登录并返回tokens
    """
    try:
        print(f"📝 开始处理注册...")
        
        username = request.username
        email = request.email
        password = request.password
        
        # 1. 创建用户
        try:
            # 从邮箱或用户名提取name值
            name_value = username if username else (email.split('@')[0] if email else 'User')
            
            cognito_client.admin_create_user(
                UserPoolId=COGNITO_USER_POOL_ID,
                Username=username,
                UserAttributes=[
                    {'Name': 'email', 'Value': email},
                    {'Name': 'email_verified', 'Value': 'true'},
                    {'Name': 'name.formatted', 'Value': name_value}  # 添加name.formatted属性（Cognito要求）
                ],
                MessageAction='SUPPRESS',  # 不发送欢迎邮件
                DesiredDeliveryMediums=[]
            )
            print(f"✅ 用户创建成功")
        except ClientError as e:
            error_code = e.response['Error']['Code']
            if error_code == 'UsernameExistsException':
                raise HTTPException(status_code=409, detail="用户名已存在")
            elif error_code == 'InvalidParameterException':
                raise HTTPException(status_code=400, detail="输入参数无效")
            else:
                raise
        
        # 2. 设置密码
        try:
            cognito_client.admin_set_user_password(
                UserPoolId=COGNITO_USER_POOL_ID,
                Username=username,
                Password=password,
                Permanent=True
            )
            print(f"✅ 密码设置成功")
        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']
            print(f"⚠️ 密码设置失败: [{error_code}] {error_message}")
            raise HTTPException(status_code=400, detail=f"密码设置失败: {error_message}")
        
        # 3. 自动登录
        try:
            response = cognito_client.admin_initiate_auth(
                UserPoolId=COGNITO_USER_POOL_ID,
                ClientId=COGNITO_CLIENT_ID,
                AuthFlow='ADMIN_NO_SRP_AUTH',
                AuthParameters={
                    'USERNAME': username,
                    'PASSWORD': password
                }
            )
            
            if 'AuthenticationResult' in response:
                tokens = response['AuthenticationResult']
            else:
                raise HTTPException(status_code=500, detail="注册后自动登录失败")
            
            print(f"✅ 注册并登录成功")
            
            return AuthResponse(
                accessToken=tokens['AccessToken'],
                idToken=tokens['IdToken'],
                refreshToken=tokens['RefreshToken']
            )
            
        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']
            print(f"⚠️ 自动登录失败: [{error_code}] {error_message}")
            # 即使自动登录失败，用户已创建成功
            raise HTTPException(status_code=500, detail="注册成功，但自动登录失败，请手动登录")
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ 注册失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"注册失败: {str(e)}")


@router.post("/phone/signup", summary="手机号注册（发送验证码）")
async def phone_signup(request: PhoneSignUpRequest):
    """
    手机号注册端点
    
    流程：
    1. 验证手机号格式
    2. 在Cognito中注册用户（使用手机号作为用户名）
    3. 触发短信验证码发送
    4. 返回成功状态（不需要返回tokens，需要验证码后才能登录）
    """
    try:
        print(f"📱 开始处理手机号注册: {request.phone_number}")
        
        phone_number = request.phone_number
        
        # 验证手机号格式（基本验证）
        if not phone_number.startswith('+'):
            raise HTTPException(status_code=400, detail="手机号格式错误，请包含国家代码（如+86）")
        
        # 使用手机号作为用户名（Cognito支持）
        username = phone_number
        
        # 1. 使用sign_up API创建用户（这会自动发送验证码）
        try:
            user_attributes = [
                {'Name': 'phone_number', 'Value': phone_number},
                {'Name': 'phone_number_verified', 'Value': 'false'}
            ]
            
            # 如果提供了姓名，添加到用户属性中
            if request.name:
                user_attributes.append({'Name': 'name', 'Value': request.name})
            
            response = cognito_client.sign_up(
                ClientId=COGNITO_CLIENT_ID,
                Username=username,
                Password="TempPass123!@#",  # 临时密码，验证码确认后会要求设置新密码
                UserAttributes=user_attributes
            )
            
            print(f"✅ 用户创建成功，验证码已发送")
            
            return {
                "success": True,
                "message": "验证码已发送",
                "userSub": response.get('UserSub'),
                "codeDeliveryDetails": response.get('CodeDeliveryDetails')
            }
            
        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']
            
            print(f"❌ Cognito错误: [{error_code}] {error_message}")
            
            if error_code == 'UsernameExistsException':
                # 用户已存在，可能是未验证的手机号，尝试重新发送验证码
                try:
                    cognito_client.resend_confirmation_code(
                        ClientId=COGNITO_CLIENT_ID,
                        Username=username
                    )
                    print(f"✅ 验证码已重新发送")
                    return {
                        "success": True,
                        "message": "验证码已重新发送"
                    }
                except ClientError as resend_error:
                    error_code_resend = resend_error.response['Error']['Code']
                    if error_code_resend == 'InvalidParameterException':
                        # 可能是已验证的用户，尝试直接登录
                        raise HTTPException(status_code=409, detail="该手机号已注册，请直接登录")
                    raise HTTPException(status_code=400, detail=f"重新发送验证码失败: {resend_error.response['Error']['Message']}")
            elif error_code == 'InvalidParameterException':
                raise HTTPException(status_code=400, detail=f"手机号格式错误: {error_message}")
            else:
                raise HTTPException(status_code=400, detail=f"注册失败: {error_message}")
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ 手机号注册失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"注册失败: {str(e)}")


@router.post("/phone/verify", response_model=AuthResponse, summary="验证手机验证码并登录")
async def verify_phone_code(request: VerifyPhoneCodeRequest):
    """
    验证手机验证码端点
    
    流程：
    1. 使用confirm_sign_up确认验证码
    2. 设置用户密码（如果需要）
    3. 自动登录并返回tokens
    """
    try:
        print(f"📱 开始验证手机验证码: {request.phone_number}")
        
        phone_number = request.phone_number
        verification_code = request.verification_code
        username = phone_number
        
        # 1. 确认验证码
        try:
            cognito_client.confirm_sign_up(
                ClientId=COGNITO_CLIENT_ID,
                Username=username,
                ConfirmationCode=verification_code
            )
            print(f"✅ 验证码确认成功")
        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']
            
            print(f"❌ 验证码确认失败: [{error_code}] {error_message}")
            
            if error_code == 'CodeMismatchException':
                raise HTTPException(status_code=400, detail="验证码错误")
            elif error_code == 'ExpiredCodeException':
                raise HTTPException(status_code=400, detail="验证码已过期，请重新获取")
            elif error_code == 'NotAuthorizedException':
                raise HTTPException(status_code=400, detail="该手机号已验证或不存在")
            else:
                raise HTTPException(status_code=400, detail=f"验证失败: {error_message}")
        
        # 2. 生成临时密码用于登录（验证码确认后用户需要设置密码）
        # 但由于我们要自动登录，我们需要设置一个密码
        import secrets
        import string
        
        # 生成一个安全的临时密码
        alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
        temp_password = ''.join(secrets.choice(alphabet) for i in range(16))
        
        try:
            cognito_client.admin_set_user_password(
                UserPoolId=COGNITO_USER_POOL_ID,
                Username=username,
                Password=temp_password,
                Permanent=False  # 临时密码，登录后建议用户修改
            )
            print(f"✅ 临时密码设置成功")
        except ClientError as e:
            # 可能密码已设置，继续尝试登录
            pass
        
        # 3. 尝试使用临时密码登录（如果用户已设置密码，则使用ADMIN_NO_SRP_AUTH）
        try:
            response = cognito_client.admin_initiate_auth(
                UserPoolId=COGNITO_USER_POOL_ID,
                ClientId=COGNITO_CLIENT_ID,
                AuthFlow='ADMIN_NO_SRP_AUTH',
                AuthParameters={
                    'USERNAME': username,
                    'PASSWORD': temp_password
                }
            )
            
            if 'AuthenticationResult' in response:
                tokens = response['AuthenticationResult']
            elif 'ChallengeName' in response:
                challenge_name = response['ChallengeName']
                
                # 如果是需要设置新密码的挑战，我们使用临时密码作为永久密码
                if challenge_name == 'NEW_PASSWORD_REQUIRED':
                    session = response['Session']
                    
                    # 使用临时密码作为永久密码（用户后续可以修改）
                    cognito_client.admin_respond_to_auth_challenge(
                        UserPoolId=COGNITO_USER_POOL_ID,
                        ClientId=COGNITO_CLIENT_ID,
                        ChallengeName='NEW_PASSWORD_REQUIRED',
                        Session=session,
                        ChallengeResponses={
                            'USERNAME': username,
                            'NEW_PASSWORD': temp_password
                        }
                    )
                    
                    # 重新尝试认证
                    response = cognito_client.admin_initiate_auth(
                        UserPoolId=COGNITO_USER_POOL_ID,
                        ClientId=COGNITO_CLIENT_ID,
                        AuthFlow='ADMIN_NO_SRP_AUTH',
                        AuthParameters={
                            'USERNAME': username,
                            'PASSWORD': temp_password
                        }
                    )
                    
                    if 'AuthenticationResult' in response:
                        tokens = response['AuthenticationResult']
                    else:
                        raise HTTPException(status_code=500, detail="设置密码后认证失败")
                else:
                    raise HTTPException(status_code=401, detail=f"不支持的挑战类型: {challenge_name}")
            else:
                raise HTTPException(status_code=500, detail="认证响应格式错误")
            
            print(f"✅ 手机号验证并登录成功")
            
            return AuthResponse(
                accessToken=tokens['AccessToken'],
                idToken=tokens['IdToken'],
                refreshToken=tokens['RefreshToken']
            )
            
        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']
            
            print(f"❌ 登录失败: [{error_code}] {error_message}")
            raise HTTPException(status_code=500, detail=f"验证成功但登录失败，请手动登录: {error_message}")
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ 验证手机验证码失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"验证失败: {str(e)}")


@router.post("/phone/login", summary="手机号登录（发送验证码）")
async def phone_login_send_code(request: PhoneSignUpRequest):
    """
    手机号登录端点（发送验证码）
    
    流程：
    1. 检查用户是否存在
    2. 使用forgot_password流程发送验证码（如果支持）
    或者使用自定义流程发送验证码
    """
    try:
        print(f"📱 开始处理手机号登录: {request.phone_number}")
        
        phone_number = request.phone_number
        username = phone_number
        
        # 检查用户是否存在
        try:
            cognito_client.admin_get_user(
                UserPoolId=COGNITO_USER_POOL_ID,
                Username=username
            )
            print(f"✅ 用户存在")
        except ClientError as e:
            error_code = e.response['Error']['Code']
            if error_code == 'UserNotFoundException':
                raise HTTPException(status_code=404, detail="该手机号未注册，请先注册")
            raise
        
        # 使用forgot_password流程发送验证码
        try:
            response = cognito_client.forgot_password(
                ClientId=COGNITO_CLIENT_ID,
                Username=username
            )
            
            print(f"✅ 验证码已发送")
            
            return {
                "success": True,
                "message": "验证码已发送到您的手机",
                "codeDeliveryDetails": response.get('CodeDeliveryDetails')
            }
            
        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']
            
            print(f"❌ 发送验证码失败: [{error_code}] {error_message}")
            
            if error_code == 'LimitExceededException':
                raise HTTPException(status_code=429, detail="发送验证码过于频繁，请稍后再试")
            else:
                raise HTTPException(status_code=400, detail=f"发送验证码失败: {error_message}")
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ 手机号登录失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"登录失败: {str(e)}")


class PhoneLoginVerifyRequest(BaseModel):
    """手机号登录验证请求"""
    phone_number: str
    verification_code: str
    new_password: str  # 使用forgot_password流程时需要设置新密码


@router.post("/phone/login/verify", response_model=AuthResponse, summary="验证手机验证码并登录（登录流程）")
async def phone_login_verify(request: PhoneLoginVerifyRequest):
    """
    手机号登录验证端点
    
    流程：
    1. 使用confirm_forgot_password确认验证码并设置新密码
    2. 使用新密码登录
    3. 返回tokens
    """
    try:
        print(f"📱 开始验证手机登录验证码: {request.phone_number}")
        
        phone_number = request.phone_number
        verification_code = request.verification_code
        new_password = request.new_password
        username = phone_number
        
        # 验证密码强度
        if len(new_password) < 8:
            raise HTTPException(status_code=400, detail="密码至少需要8个字符")
        
        # 1. 确认验证码并设置新密码
        try:
            cognito_client.confirm_forgot_password(
                ClientId=COGNITO_CLIENT_ID,
                Username=username,
                ConfirmationCode=verification_code,
                Password=new_password
            )
            print(f"✅ 验证码确认成功，密码已设置")
        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']
            
            print(f"❌ 验证码确认失败: [{error_code}] {error_message}")
            
            if error_code == 'CodeMismatchException':
                raise HTTPException(status_code=400, detail="验证码错误")
            elif error_code == 'ExpiredCodeException':
                raise HTTPException(status_code=400, detail="验证码已过期，请重新获取")
            else:
                raise HTTPException(status_code=400, detail=f"验证失败: {error_message}")
        
        # 2. 使用新密码登录
        try:
            response = cognito_client.admin_initiate_auth(
                UserPoolId=COGNITO_USER_POOL_ID,
                ClientId=COGNITO_CLIENT_ID,
                AuthFlow='ADMIN_NO_SRP_AUTH',
                AuthParameters={
                    'USERNAME': username,
                    'PASSWORD': new_password
                }
            )
            
            if 'AuthenticationResult' in response:
                tokens = response['AuthenticationResult']
            else:
                raise HTTPException(status_code=500, detail="登录失败")
            
            print(f"✅ 手机号登录成功")
            
            return AuthResponse(
                accessToken=tokens['AccessToken'],
                idToken=tokens['IdToken'],
                refreshToken=tokens['RefreshToken']
            )
            
        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']
            
            print(f"❌ 登录失败: [{error_code}] {error_message}")
            
            if error_code == 'NotAuthorizedException':
                raise HTTPException(status_code=401, detail="登录失败，请重试")
            else:
                raise HTTPException(status_code=401, detail=f"登录失败: {error_message}")
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ 验证手机登录验证码失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"验证失败: {str(e)}")


class UpdateUserNameRequest(BaseModel):
    """更新用户姓名请求"""
    name: str


@router.put("/user/name", summary="更新用户姓名")
async def update_user_name(
    request: UpdateUserNameRequest,
    user: Dict = Depends(get_current_user)
):
    """
    更新当前登录用户的姓名属性
    
    流程：
    1. 验证用户已登录
    2. 更新 Cognito 用户的 name 属性
    """
    try:
        username = user.get('username') or user.get('user_id')
        if not username:
            raise HTTPException(status_code=400, detail="无法获取用户ID")
        
        print(f"📝 更新用户姓名: user_id={username}, name={request.name}")
        
        # 更新 Cognito 用户属性
        try:
            cognito_client.admin_update_user_attributes(
                UserPoolId=COGNITO_USER_POOL_ID,
                Username=username,
                UserAttributes=[
                    {'Name': 'name', 'Value': request.name}
                ]
            )
            print(f"✅ 用户姓名更新成功")
            
            return {
                "success": True,
                "message": "姓名更新成功",
                "name": request.name
            }
        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']
            print(f"❌ Cognito错误: [{error_code}] {error_message}")
            raise HTTPException(status_code=400, detail=f"更新失败: {error_message}")
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ 更新用户姓名失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"更新失败: {str(e)}")