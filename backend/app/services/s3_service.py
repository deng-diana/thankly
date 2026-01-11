"""
S3文件上传服务

负责:
- 上传音频文件到S3
- 生成公开访问URL
"""

import boto3
from ..config import get_settings
from urllib.parse import urlparse
from typing import List
import uuid
from typing import BinaryIO


class S3Service:
    """S3文件存储服务"""
    
    def __init__(self):
        # 获取配置
        settings = get_settings()
    
        
        # 创建S3客户端
        # 在Lambda环境中，boto3会自动使用IAM角色凭证
        self.s3_client = boto3.client(
            's3',
            region_name=settings.aws_region
        )
        
        # S3桶名
        self.bucket_name = settings.s3_bucket_name

    def upload_audio(
        self,
        file_content: bytes,
        file_name: str,
        content_type: str = 'audio/m4a'
    ) -> str:
        """
        上传音频文件到S3
        
        参数:
            file_content: 文件的二进制内容
            file_name: 原始文件名（如：recording.m4a）
            content_type: 文件类型（默认audio/m4a）
        
        返回:
            S3文件的公开URL
        """
        
        # 第1步：生成唯一的文件名
        # 例如：audio/abc123-recording.m4a
        unique_id = str(uuid.uuid4())[:8]  # 取前8位
        s3_key = f"audio/{unique_id}-{file_name}"
        
        try:
            # 第2步：上传到S3（设置为公开可读）
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=s3_key,
                Body=file_content,
                ContentType=content_type,
            )
            
            # 第3步：生成公开URL（不需要签名，直接访问）
            # 前提：Bucket策略允许公开读取
            url = f"https://{self.bucket_name}.s3.amazonaws.com/{s3_key}"
            
            print(f"✅ 文件上传成功: {url}")
            return url
            
        except Exception as e:
            print(f"❌ S3上传失败: {str(e)}")
            raise
    def upload_image(
        self,
        file_content: bytes,
        file_name: str,
        content_type: str = 'image/jpeg'
    ) -> str:
        """
        Upload image file to S3
        
        Args:
            file_content: Binary content of the image file
            file_name: Original filename (e.g., photo.jpg)
            content_type: File type (default: image/jpeg)
        
        Returns:
            Public URL of the uploaded image
        """
        # Step 1: Generate unique filename
        # Example: images/abc123-photo.jpg
        unique_id = str(uuid.uuid4())[:8]
        s3_key = f"images/{unique_id}-{file_name}"
        
        try:
            # Step 2: Upload to S3 (public readable)
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=s3_key,
                Body=file_content,
                ContentType=content_type,
            )
            
            # Step 3: Generate public URL
            url = f"https://{self.bucket_name}.s3.amazonaws.com/{s3_key}"
            
            print(f"✅ Image uploaded successfully: {url}")
            return url
            
        except Exception as e:
            print(f"❌ S3 upload failed: {str(e)}")
            raise

    def generate_presigned_url(
        self,
        file_name: str,
        content_type: str = 'image/jpeg',
        expiration: int = 3600
    ) -> dict:
        """
        Generate presigned URL for direct S3 upload (bypass Lambda size limit)
        
        This allows frontend to upload images directly to S3 without going through Lambda.
        Lambda has a 6MB payload limit, but S3 can handle much larger files.
        
        Args:
            file_name: Original filename (e.g., photo.jpg)
            content_type: File MIME type (default: image/jpeg)
            expiration: URL expiration time in seconds (default: 1 hour)
        
        Returns:
            Dictionary with:
                - presigned_url: URL for direct upload
                - s3_key: S3 object key (for reference)
                - final_url: Final public URL after upload
        """
        # Generate unique S3 key
        unique_id = str(uuid.uuid4())[:8]
        s3_key = f"images/{unique_id}-{file_name}"
        
        try:
            # Generate presigned POST URL (allows direct upload from browser)
            presigned_url = self.s3_client.generate_presigned_url(
                'put_object',
                Params={
                    'Bucket': self.bucket_name,
                    'Key': s3_key,
                    'ContentType': content_type,
                },
                ExpiresIn=expiration
            )
            
            # Final public URL (after upload)
            final_url = f"https://{self.bucket_name}.s3.amazonaws.com/{s3_key}"
            
            print(f"✅ Generated presigned URL for: {s3_key}")
            
            return {
                "presigned_url": presigned_url,
                "s3_key": s3_key,
                "final_url": final_url
            }
            
        except Exception as e:
            print(f"❌ Failed to generate presigned URL: {str(e)}")
            raise

    def delete_objects_by_urls(self, urls: List[str]) -> None:
        """根据URL删除对象"""
        if not urls:
            return

        keys = []
        for url in urls:
            if not url:
                continue

            try:
                parsed = urlparse(url)
                # 兼容不同的 S3 URL 格式
                path = parsed.path.lstrip('/')

                if not path and parsed.netloc:
                    # 尝试从自定义域名解析
                    marker = f"{self.bucket_name}/"
                    if marker in url:
                        path = url.split(marker, 1)[1]

                if not path:
                    print(f"⚠️ 无法从URL解析S3路径: {url}")
                    continue

                keys.append(path)
            except Exception as parse_error:
                print(f"⚠️ 解析S3 URL失败: {url} - {parse_error}")

        if not keys:
            return

        # S3 批量删除每次最多1000个对象
        chunk_size = 1000
        for i in range(0, len(keys), chunk_size):
            chunk = keys[i : i + chunk_size]
            try:
                delete_payload = {
                    'Objects': [{'Key': key} for key in chunk],
                    'Quiet': True
                }
                self.s3_client.delete_objects(
                    Bucket=self.bucket_name,
                    Delete=delete_payload
                )
                print(f"🗑️ 已删除S3对象: {chunk}")
            except Exception as delete_error:
                print(f"❌ 删除S3对象失败: {delete_error}")
                raise

    def delete_image_by_url(self, url: str) -> None:
        """
        删除单个图片（便捷方法）
        
        Args:
            url: S3图片URL
        """
        self.delete_objects_by_urls([url])