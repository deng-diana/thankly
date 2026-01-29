"""
邀请码生成与验证工具
Invite Code Generator and Validator
"""

import random
import string
from typing import Optional


def generate_invite_code(length: int = 6) -> str:
    """
    生成邀请码（大写字母 + 数字）
    
    Args:
        length: 邀请码长度，默认 6 位
    
    Returns:
        6位邀请码，例如: "A3F9K2"
    """
    chars = string.ascii_uppercase + string.digits
    # 排除易混淆字符：0/O, 1/I/L
    chars = chars.replace('0', '').replace('O', '').replace('I', '').replace('L', '')
    return ''.join(random.choices(chars, k=length))


def validate_invite_code_format(code: str) -> bool:
    """
    验证邀请码格式
    
    Args:
        code: 待验证的邀请码
    
    Returns:
        格式是否正确
    """
    if not code or len(code) != 6:
        return False
    
    # 必须是大写字母 + 数字
    return all(c in (string.ascii_uppercase + string.digits) for c in code)


def normalize_invite_code(code: str) -> str:
    """
    标准化邀请码（转大写、去除空格）
    
    Args:
        code: 用户输入的邀请码
    
    Returns:
        标准化后的邀请码
    """
    return code.upper().strip().replace(' ', '')


def generate_unique_invite_code(check_exists_func) -> str:
    """
    生成唯一邀请码（检查数据库是否已存在）
    
    Args:
        check_exists_func: 检查邀请码是否存在的函数 (str) -> bool
    
    Returns:
        唯一邀请码
    """
    max_attempts = 10
    for _ in range(max_attempts):
        code = generate_invite_code()
        if not check_exists_func(code):
            return code
    
    # If 10 attempts all collide, increase length and retry
    code = generate_invite_code(length=8)
    return code
