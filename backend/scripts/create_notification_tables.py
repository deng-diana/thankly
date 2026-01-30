"""
Create DynamoDB tables for push notifications

Tables:
1. thankly-push-tokens-prod - Store user push tokens
2. thankly-push-rate-limit-prod - Rate limiting for push notifications
"""

import boto3
import sys

# Configuration
REGION = 'us-east-1'  # Update based on your AWS region
ENVIRONMENT = 'prod'  # or 'dev'

dynamodb = boto3.client('dynamodb', region_name=REGION)


def create_push_tokens_table():
    """Create push tokens table"""
    table_name = f'thankly-push-tokens-{ENVIRONMENT}'
    
    try:
        response = dynamodb.create_table(
            TableName=table_name,
            KeySchema=[
                {'AttributeName': 'userId', 'KeyType': 'HASH'},  # Partition key
                {'AttributeName': 'deviceId', 'KeyType': 'RANGE'},  # Sort key
            ],
            AttributeDefinitions=[
                {'AttributeName': 'userId', 'AttributeType': 'S'},
                {'AttributeName': 'deviceId', 'AttributeType': 'S'},
            ],
            BillingMode='PAY_PER_REQUEST',  # On-demand pricing
            Tags=[
                {'Key': 'Environment', 'Value': ENVIRONMENT},
                {'Key': 'Application', 'Value': 'Thankly'},
                {'Key': 'Purpose', 'Value': 'PushNotifications'},
            ],
        )
        
        print(f"✅ Created table: {table_name}")
        print(f"   Status: {response['TableDescription']['TableStatus']}")
        return True
        
    except dynamodb.exceptions.ResourceInUseException:
        print(f"⚠️  Table {table_name} already exists")
        return False
    except Exception as e:
        print(f"❌ Failed to create table {table_name}: {e}")
        sys.exit(1)


def create_rate_limit_table():
    """Create rate limit table with TTL"""
    table_name = f'thankly-push-rate-limit-{ENVIRONMENT}'
    
    try:
        response = dynamodb.create_table(
            TableName=table_name,
            KeySchema=[
                {'AttributeName': 'rateKey', 'KeyType': 'HASH'},  # userId#circleId#date
            ],
            AttributeDefinitions=[
                {'AttributeName': 'rateKey', 'AttributeType': 'S'},
            ],
            BillingMode='PAY_PER_REQUEST',
            Tags=[
                {'Key': 'Environment', 'Value': ENVIRONMENT},
                {'Key': 'Application', 'Value': 'Thankly'},
                {'Key': 'Purpose', 'Value': 'RateLimiting'},
            ],
        )
        
        print(f"✅ Created table: {table_name}")
        print(f"   Status: {response['TableDescription']['TableStatus']}")
        
        # Enable TTL
        print(f"⏳ Enabling TTL on table {table_name}...")
        dynamodb.update_time_to_live(
            TableName=table_name,
            TimeToLiveSpecification={
                'Enabled': True,
                'AttributeName': 'ttl'
            }
        )
        print(f"✅ TTL enabled on 'ttl' attribute")
        
        return True
        
    except dynamodb.exceptions.ResourceInUseException:
        print(f"⚠️  Table {table_name} already exists")
        return False
    except Exception as e:
        print(f"❌ Failed to create table {table_name}: {e}")
        sys.exit(1)


if __name__ == '__main__':
    print("🚀 Creating DynamoDB tables for push notifications...")
    print(f"   Region: {REGION}")
    print(f"   Environment: {ENVIRONMENT}")
    print()
    
    create_push_tokens_table()
    print()
    create_rate_limit_table()
    print()
    print("🎉 All tables created successfully!")
    print()
    print("📋 Next steps:")
    print("   1. Wait for tables to become ACTIVE (check AWS Console)")
    print("   2. Update backend/app/services/notification_service.py with correct table names")
    print("   3. Deploy backend with new notification API")
