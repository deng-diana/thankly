from jose import jwt
from jose.exceptions import JWTError, ExpiredSignatureError, JWTClaimsError
from jose.backends import RSAKey
import requests
from fastapi import HTTPException, Header
from functools import lru_cache
from typing import Optional, Dict
from ..config import get_settings

class CognitoJWTVerifier:
    """Cognito JWT Token验证器"""
    
    def __init__(self):
        # 🔥 每次初始化时重新获取配置，避免缓存问题
        self.settings = get_settings()
        # 🔍 调试：检查配置是否正确加载
        if not self.settings.cognito_user_pool_id:
            print(f"⚠️ 警告: Cognito User Pool ID 为空，当前配置: {self.settings}")
        self._region = None
        self._user_pool_id = None
        self._app_client_id = None
        self._keys_url = None
        self._public_keys = None  # 缓存公钥
    
    def _ensure_config(self):
        """延迟初始化配置，避免启动时就报错"""
        if self._keys_url is None:
            # 🔥 每次都重新获取配置，确保是最新的
            self.settings = get_settings()
            
            self._region = self.settings.cognito_region
            self._user_pool_id = (self.settings.cognito_user_pool_id or "").strip()
            self._app_client_id = self.settings.cognito_client_id
            
            # 🔍 调试：详细记录配置信息
            print(f"🔍 配置检查: region={self._region}, pool_id长度={len(self._user_pool_id)}, client_id长度={len(self._app_client_id or '')}")
            
            if not self._user_pool_id:
                print(f"❌ 配置错误: settings.cognito_user_pool_id = '{self.settings.cognito_user_pool_id}'")
                print(f"❌ 完整配置: {self.settings}")
                raise HTTPException(
                    status_code=500,
                    detail="Cognito User Pool ID 未配置，请检查环境变量"
                )
            
            # 确保URL格式正确：移除末尾斜杠，避免双斜杠
            base_url = f"https://cognito-idp.{self._region}.amazonaws.com"
            self._keys_url = f"{base_url}/{self._user_pool_id}/.well-known/jwks.json"
    
    def get_public_keys(self) -> Dict:
        """
        获取Cognito公钥
        用于验证JWT签名
        """
        # 延迟初始化配置
        self._ensure_config()
        
        if self._public_keys is None:
            try:
                print(f"🔑 正在获取Cognito公钥: {self._keys_url}")
                response = requests.get(self._keys_url, timeout=10)
                response.raise_for_status()
                self._public_keys = response.json()
                print(f"✅ 成功获取公钥")
            except requests.exceptions.RequestException as e:
                print(f"❌ 获取Cognito公钥失败: {e}")
                print(f"   URL: {self._keys_url}")
                raise HTTPException(
                    status_code=500,
                    detail=f"无法获取Cognito公钥: {str(e)}"
                )
        
        return self._public_keys
    
    def verify_token(self, token: str) -> Dict:
        """
        验证JWT Token
        
        参数:
            token: JWT token字符串
        
        返回:
            解码后的token payload (包含用户信息)
        
        抛出:
            HTTPException: Token无效时
        """
        try:
            # 1. 解码token header (不验证签名)
            headers = jwt.get_unverified_header(token)
            kid = headers['kid']
            
            # 2. 获取对应的公钥
            public_keys = self.get_public_keys()
            key = None
            for k in public_keys['keys']:
                if k['kid'] == kid:
                    key = k
                    break
            
            if not key:
                raise HTTPException(
                    status_code=401,
                    detail="无效的token: 找不到公钥"
                )
            
            # 3. 转换公钥格式
            public_key = RSAKey(key, algorithm='RS256')
            
            # 4. 验证token
            # 先解码token查看类型
            temp_payload = jwt.get_unverified_claims(token)
            token_use = temp_payload.get('token_use')
            
            # 延迟初始化配置
            self._ensure_config()
            
            # 根据token类型决定是否验证audience
            # access_token 没有 aud 字段，id_token 有 aud 字段
            verify_aud = token_use == 'id'
            
            payload = jwt.decode(
                token,
                public_key,
                algorithms=['RS256'],
                audience=self._app_client_id if verify_aud else None,  # 只有id_token验证audience
                options={
                    "verify_signature": True,
                    "verify_exp": True,  # 验证过期时间
                    "verify_aud": verify_aud,  # 根据token类型决定是否验证audience
                }
            )
            
            # 5. 验证token类型 (id_token 或 access_token)
            token_use = payload.get('token_use')
            if token_use not in ['id', 'access']:
                raise HTTPException(
                    status_code=401,
                    detail="无效的token类型"
                )
            
            return payload
            
        except ExpiredSignatureError:
            raise HTTPException(
                status_code=401,
                detail="Token已过期,请重新登录"
            )
        except (JWTError, JWTClaimsError) as e:
            raise HTTPException(
                status_code=401,
                detail=f"无效的token: {str(e)}"
            )
        except Exception as e:
            raise HTTPException(
                status_code=401,
                detail=f"Token验证失败: {str(e)}"
            )

# 🔥 延迟初始化全局实例（避免导入时就读取配置）
_jwt_verifier: Optional[CognitoJWTVerifier] = None

def _get_jwt_verifier() -> CognitoJWTVerifier:
    """获取全局 JWT 验证器实例（懒加载）"""
    global _jwt_verifier
    if _jwt_verifier is None:
        _jwt_verifier = CognitoJWTVerifier()
    return _jwt_verifier

async def get_current_user(
    authorization: Optional[str] = Header(None)
) -> Dict:
    """
    从请求头获取并验证用户
    
    前端需要在Header添加: Authorization: Bearer <token>
    
    返回:
        用户信息字典,包含:
        - sub: 用户唯一ID (Cognito User ID)
        - email: 邮箱
        - name: 姓名
        - email_verified: 邮箱是否验证
    """
    if not authorization:
        raise HTTPException(
            status_code=401,
            detail="未提供认证token,请在Header添加: Authorization: Bearer <token>"
        )
    
    # 检查Bearer格式
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != 'bearer':
        raise HTTPException(
            status_code=401,
            detail="认证格式错误,应为: Bearer <token>"
        )
    
    token = parts[1]
    
    # 🔍 调试：记录token验证请求
    print(f"🔍 验证token请求 - token长度: {len(token)}, 前20字符: {token[:20]}...")
    
    # 验证token（延迟初始化实例）
    try:
        payload = _get_jwt_verifier().verify_token(token)
        print(f"✅ Token验证成功 - user_id: {payload.get('sub')}")
    except HTTPException as e:
        print(f"❌ Token验证失败: {e.detail}")
        raise
    
    # 提取用户信息
    # 优先使用 name，如果没有则使用 given_name 或 nickname
    name = payload.get('name', '') or payload.get('given_name', '') or payload.get('nickname', '')
    
    user_info = {
        'user_id': payload.get('sub'),  # Cognito用户唯一ID
        'email': payload.get('email', ''),
        'name': name,
        'email_verified': payload.get('email_verified', False),
        'username': payload.get('cognito:username', payload.get('sub')),
    }
    
    # 🔍 调试：打印用户名字信息（详细调试）
    print(f"👤 用户信息提取 - user_id: {user_info['user_id']}, name: '{name}'")
    print(f"   JWT payload中的name相关字段: name={payload.get('name')}, given_name={payload.get('given_name')}, nickname={payload.get('nickname')}")
    print(f"   JWT payload中的所有字段: {list(payload.keys())}")
    # 如果名字为空，尝试从其他字段获取
    if not name:
        print(f"   ⚠️ 警告：JWT token中没有找到name字段！")
        print(f"   尝试从其他字段获取...")
        # 检查是否有自定义属性
        for key in payload.keys():
            if 'name' in key.lower() or 'given' in key.lower():
                print(f"   发现相关字段: {key} = {payload.get(key)}")
    
    # 如果是社交登录,可能有额外字段
    if 'identities' in payload:
        # 社交登录用户
        identities = payload['identities']
        if isinstance(identities, str):
            import json
            identities = json.loads(identities)
        
        if identities:
            user_info['provider'] = identities[0].get('providerName', 'Unknown')
    
    return user_info

async def get_optional_user(
    authorization: Optional[str] = Header(None)
) -> Optional[Dict]:
    """
    可选的用户认证
    如果有token就验证,没有就返回None
    用于某些不强制登录的接口
    """
    if not authorization:
        return None
    
    try:
        return await get_current_user(authorization)
    except HTTPException:
        return None