#!/usr/bin/env python3
"""
创建亲密圈功能的 DynamoDB 表
执行: python backend/scripts/create_circle_tables.py
"""

import boto3
import sys
import os

# 添加项目路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from app.config import get_settings

def create_circles_table(dynamodb, table_name: str):
    """创建 circles 表（圈子基本信息）"""
    try:
        table = dynamodb.create_table(
            TableName=table_name,
            KeySchema=[
                {'AttributeName': 'circleId', 'KeyType': 'HASH'}  # Partition key
            ],
            AttributeDefinitions=[
                {'AttributeName': 'circleId', 'AttributeType': 'S'},
                {'AttributeName': 'userId', 'AttributeType': 'S'},
                {'AttributeName': 'inviteCode', 'AttributeType': 'S'},
                {'AttributeName': 'createdAt', 'AttributeType': 'S'}
            ],
            GlobalSecondaryIndexes=[
                {
                    'IndexName': 'userId-createdAt-index',
                    'KeySchema': [
                        {'AttributeName': 'userId', 'KeyType': 'HASH'},
                        {'AttributeName': 'createdAt', 'KeyType': 'RANGE'}
                    ],
                    'Projection': {'ProjectionType': 'ALL'},
                    'ProvisionedThroughput': {
                        'ReadCapacityUnits': 5,
                        'WriteCapacityUnits': 5
                    }
                },
                {
                    'IndexName': 'inviteCode-index',
                    'KeySchema': [
                        {'AttributeName': 'inviteCode', 'KeyType': 'HASH'}
                    ],
                    'Projection': {'ProjectionType': 'ALL'},
                    'ProvisionedThroughput': {
                        'ReadCapacityUnits': 5,
                        'WriteCapacityUnits': 5
                    }
                }
            ],
            BillingMode='PAY_PER_REQUEST',  # 按需计费
            Tags=[
                {'Key': 'Project', 'Value': 'Thankly'},
                {'Key': 'Feature', 'Value': 'IntimateCircle'}
            ]
        )
        table.wait_until_exists()
        print(f"✅ 表创建成功: {table_name}")
        return table
    except dynamodb.meta.client.exceptions.ResourceInUseException:
        print(f"⚠️  表已存在: {table_name}")
        return dynamodb.Table(table_name)


def create_circle_members_table(dynamodb, table_name: str):
    """创建 circle_members 表（圈子成员关系）"""
    try:
        table = dynamodb.create_table(
            TableName=table_name,
            KeySchema=[
                {'AttributeName': 'circleId', 'KeyType': 'HASH'},  # Partition key
                {'AttributeName': 'userId', 'KeyType': 'RANGE'}    # Sort key
            ],
            AttributeDefinitions=[
                {'AttributeName': 'circleId', 'AttributeType': 'S'},
                {'AttributeName': 'userId', 'AttributeType': 'S'},
                {'AttributeName': 'joinedAt', 'AttributeType': 'S'}
            ],
            GlobalSecondaryIndexes=[
                {
                    'IndexName': 'userId-joinedAt-index',
                    'KeySchema': [
                        {'AttributeName': 'userId', 'KeyType': 'HASH'},
                        {'AttributeName': 'joinedAt', 'KeyType': 'RANGE'}
                    ],
                    'Projection': {'ProjectionType': 'ALL'},
                    'ProvisionedThroughput': {
                        'ReadCapacityUnits': 5,
                        'WriteCapacityUnits': 5
                    }
                }
            ],
            BillingMode='PAY_PER_REQUEST',
            Tags=[
                {'Key': 'Project', 'Value': 'Thankly'},
                {'Key': 'Feature', 'Value': 'IntimateCircle'}
            ]
        )
        table.wait_until_exists()
        print(f"✅ 表创建成功: {table_name}")
        return table
    except dynamodb.meta.client.exceptions.ResourceInUseException:
        print(f"⚠️  表已存在: {table_name}")
        return dynamodb.Table(table_name)


def create_diary_shares_table(dynamodb, table_name: str):
    """创建 diary_shares 表（日记分享关系 + 冗余字段优化）"""
    try:
        table = dynamodb.create_table(
            TableName=table_name,
            KeySchema=[
                {'AttributeName': 'shareId', 'KeyType': 'HASH'}  # Partition key
            ],
            AttributeDefinitions=[
                {'AttributeName': 'shareId', 'AttributeType': 'S'},
                {'AttributeName': 'diaryId', 'AttributeType': 'S'},
                {'AttributeName': 'circleId', 'AttributeType': 'S'},
                {'AttributeName': 'sharedAt', 'AttributeType': 'S'}
            ],
            GlobalSecondaryIndexes=[
                {
                    'IndexName': 'diaryId-index',
                    'KeySchema': [
                        {'AttributeName': 'diaryId', 'KeyType': 'HASH'}
                    ],
                    'Projection': {'ProjectionType': 'ALL'},
                    'ProvisionedThroughput': {
                        'ReadCapacityUnits': 5,
                        'WriteCapacityUnits': 5
                    }
                },
                {
                    'IndexName': 'circleId-sharedAt-index',
                    'KeySchema': [
                        {'AttributeName': 'circleId', 'KeyType': 'HASH'},
                        {'AttributeName': 'sharedAt', 'KeyType': 'RANGE'}
                    ],
                    'Projection': {'ProjectionType': 'ALL'},
                    'ProvisionedThroughput': {
                        'ReadCapacityUnits': 5,
                        'WriteCapacityUnits': 5
                    }
                }
            ],
            BillingMode='PAY_PER_REQUEST',
            Tags=[
                {'Key': 'Project', 'Value': 'Thankly'},
                {'Key': 'Feature', 'Value': 'IntimateCircle'}
            ]
        )
        table.wait_until_exists()
        print(f"✅ 表创建成功: {table_name}")
        return table
    except dynamodb.meta.client.exceptions.ResourceInUseException:
        print(f"⚠️  表已存在: {table_name}")
        return dynamodb.Table(table_name)


def main():
    """主函数"""
    print("🚀 开始创建亲密圈 DynamoDB 表...\n")
    
    settings = get_settings()
    dynamodb = boto3.resource('dynamodb', region_name=settings.aws_region)
    
    # 表名配置
    env_suffix = '-prod' if settings.environment == 'production' else '-dev'
    
    tables = [
        (f'thankly-circles{env_suffix}', create_circles_table),
        (f'thankly-circle-members{env_suffix}', create_circle_members_table),
        (f'thankly-diary-shares{env_suffix}', create_diary_shares_table)
    ]
    
    # 创建所有表
    for table_name, create_func in tables:
        print(f"\n📋 创建表: {table_name}")
        create_func(dynamodb, table_name)
    
    print("\n✅ 所有表创建完成！")
    print("\n📊 表结构总览:")
    print("  1. thankly-circles: 圈子基本信息（主键: circleId）")
    print("     - GSI: userId-createdAt-index (查询用户创建的圈子)")
    print("     - GSI: inviteCode-index (邀请码查询)")
    print("  2. thankly-circle-members: 成员关系（主键: circleId+userId）")
    print("     - GSI: userId-joinedAt-index (查询用户加入的圈子)")
    print("  3. thankly-diary-shares: 分享关系 + 冗余字段（主键: shareId）")
    print("     - GSI: diaryId-index (查询日记分享状态)")
    print("     - GSI: circleId-sharedAt-index (圈子动态流)")


if __name__ == '__main__':
    main()
