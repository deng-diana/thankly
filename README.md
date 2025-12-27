# Gratitude Journal

A modern, AI-powered gratitude journaling application built with React Native and FastAPI. Available on iOS App Store.

## 🌟 Features

- **Multi-modal Journaling**: Create entries with text, voice, or images
- **AI-Powered Enhancement**: Automatic text polishing, title generation, and personalized feedback
- **Multilingual Support**: AI adapts to your language (Chinese, English, Japanese, Korean, etc.)
- **Voice Transcription**: High-accuracy speech-to-text using OpenAI Whisper
- **Image Diaries**: Upload up to 9 images per entry with carousel view
- **Audio Playback**: Built-in audio player for voice diary entries
- **Cloud Sync**: Secure cloud storage with AWS services

## 🏗️ Architecture

### Tech Stack

**Frontend:**

- React Native with Expo
- TypeScript
- React Navigation
- AWS Amplify (Authentication)
- Expo AV (Audio)
- Expo Image Picker

**Backend:**

- Python FastAPI
- AWS Lambda (Serverless)
- AWS DynamoDB (Database)
- AWS S3 (File Storage)
- AWS Cognito (Authentication)
- OpenAI API (Whisper, GPT-4o-mini)

**Infrastructure:**

- AWS Lambda for serverless backend
- GitHub Actions for CI/CD
- Docker for containerization
- EAS Build for mobile app distribution

## 📁 Project Structure

```
gratitude-journal/
├── backend/          # FastAPI backend
│   ├── app/         # Application code
│   │   ├── main.py  # FastAPI app entry point
│   │   ├── routers/ # API endpoints
│   │   ├── services/ # Business logic
│   │   └── models/  # Pydantic models
│   ├── Dockerfile   # Container definition
│   └── requirements.txt
├── mobile/          # React Native app
│   ├── src/
│   │   ├── components/ # Reusable components
│   │   ├── screens/    # Screen components
│   │   ├── services/   # API services
│   │   ├── navigation/ # Routing
│   │   └── styles/     # Global styles
│   └── package.json
├── docs/            # Documentation
├── scripts/         # Deployment scripts
└── .github/         # CI/CD workflows
```

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- Python 3.11+
- AWS CLI configured
- Expo CLI or EAS CLI
- Docker (for backend deployment)

### Frontend Setup

```bash
cd mobile
npm install
npm start
```

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Environment Variables

Create `.env` files in both `backend/` and `mobile/` directories with required credentials:

**Backend `.env`:**

```
OPENAI_API_KEY=your_openai_key
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
COGNITO_USER_POOL_ID=your_pool_id
COGNITO_CLIENT_ID=your_client_id
```

**Mobile `.env`:**

```
EXPO_PUBLIC_API_BASE_URL=your_api_url
```

## 📱 Development

### Running Locally

**Frontend:**

```bash
cd mobile
npm start
# Press 'i' for iOS simulator, 'a' for Android
```

**Backend:**

```bash
cd backend
uvicorn app.main:app --reload
```

### Building for Production

**Mobile App:**

```bash
cd mobile
eas build --platform ios
eas build --platform android
```

**Backend:**

```bash
cd backend
./deploy.sh
```

## 🔧 Configuration

### AWS Services

- **Lambda**: Serverless function hosting
- **DynamoDB**: NoSQL database for diary entries
- **S3**: Object storage for audio and images
- **Cognito**: User authentication and authorization
- **API Gateway**: REST API endpoint

### CI/CD

GitHub Actions workflows are configured for:

- Automatic backend deployment to Lambda
- Mobile app builds via EAS

See `.github/workflows/` for configuration details.

### ⚠️ Pre-Push Checklist

**Before pushing code to GitHub, ensure:**

1. **`mobile/src/config/aws-config.ts`**: Set `IS_LOCAL_DEV = false` for production builds
2. **`mobile/src/navigation/AppNavigator.tsx`**: Set `DEV_MODE_FORCE_ONBOARDING = false`

A pre-commit hook is configured to automatically check these settings. If you see an error during commit, fix the configuration and try again.

## 📚 Documentation

- [Project Structure](./PROJECT_STRUCTURE.md) - Detailed architecture documentation
- [TODO List](./TODO.md) - Upcoming features and improvements
- [Deployment Guide](./docs/DEPLOYMENT_GUIDE.md) - Deployment instructions
- [GitHub Actions Setup](./docs/GITHUB_ACTIONS_SETUP.md) - CI/CD configuration

## 🧪 Testing

### Frontend

```bash
cd mobile
npm test
```

### Backend

```bash
cd backend
pytest
```

## 🤝 Contributing

This is a personal project, but suggestions and feedback are welcome!

## 📄 License

Private project - All rights reserved

## 👤 Author

Built with ❤️ for capturing life's meaningful moments

---

**Note**: This project is currently live on the iOS App Store. For production deployment, ensure all environment variables and AWS credentials are properly configured.
