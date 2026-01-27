# thankly

A modern, AI-powered voice-first multimodal journaling application built with React Native and FastAPI. Available on iOS App Store.

AI Collaboration Guide: Please read CLAUDE.md

## 🌟 Features

### Core Journaling Capabilities

- **Multi-modal Journaling**: Create entries with text, voice, images, or any combination
  - **Voice Diary**: Record your thoughts with real-time transcription
  - **Text Diary**: Write directly with AI-powered enhancement
  - **Image Diary**: Upload up to 9 images per entry with carousel view
  - **Combined Modes**: Mix and match - image + text, image + voice, or image + text + voice

### AI-Powered Features

- **Intelligent Transcription**: High-accuracy speech-to-text using OpenAI Whisper
- **Text Enhancement**: Automatic text polishing while preserving your original voice
- **Smart Title Generation**: AI-generated titles that capture the essence of your entry
- **Personalized Feedback**: Warm, empathetic AI responses using your name
- **Multilingual Support**: AI automatically adapts to your language (Chinese, English, Japanese, Korean, etc.)

### User Experience

- **Real-time Progress Tracking**: Live progress updates during voice processing (0% → 100%)
- **Audio Playback**: Built-in audio player for voice diary entries
- **Image Carousel**: Beautiful image viewing experience with swipe navigation
- **Edit & Refine**: Edit your entries anytime with instant save
- **Cloud Sync**: Secure cloud storage with AWS services, accessible across devices

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
- AWS S3 (File Storage with presigned URLs)
- AWS Cognito (Authentication)
- OpenAI API (Whisper for transcription, GPT-4o-mini for enhancement)
- Async task processing with progress tracking

**Infrastructure:**

- AWS Lambda for serverless backend
- GitHub Actions for CI/CD
- Docker for containerization
- EAS Build for mobile app distribution

## 📁 Project Structure

```
thankly/
├── backend/              # FastAPI backend
│   ├── app/
│   │   ├── main.py      # FastAPI app entry point
│   │   ├── routers/     # API endpoints (diary, auth, account)
│   │   ├── services/    # Business logic (OpenAI, DynamoDB, S3)
│   │   ├── models/      # Pydantic models
│   │   └── utils/       # Utilities (auth, transcription)
│   ├── Dockerfile       # Container definition
│   ├── lambda_handler.py # AWS Lambda entry point
│   └── requirements.txt
├── mobile/              # React Native app
│   ├── src/
│   │   ├── components/  # Reusable components (modals, players, etc.)
│   │   ├── screens/     # Screen components (list, detail, login, etc.)
│   │   ├── services/    # API services (diary, auth, account)
│   │   ├── navigation/  # Routing configuration
│   │   ├── hooks/       # Custom React hooks
│   │   ├── i18n/        # Internationalization (Chinese, English)
│   │   └── styles/      # Global styles and typography
│   ├── app.json         # Expo configuration
│   └── package.json
├── docs/                # Documentation
├── scripts/             # Deployment and setup scripts
└── .github/             # CI/CD workflows
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

- **Lambda**: Serverless function hosting for backend API
- **DynamoDB**: NoSQL database for diary entries and user data
- **S3**: Object storage for audio and images (with presigned URLs for direct upload)
- **Cognito**: User authentication and authorization
- **API Gateway**: REST API endpoint

### Key Technical Features

- **Async Task Processing**: Background processing with real-time progress tracking via polling
- **Presigned URLs**: Direct S3 upload bypassing Lambda's 6MB payload limit
- **Parallel Processing**: Simultaneous S3 upload and transcription for faster processing
- **Optimized Voice Pipeline**: Separate fast path for pure voice diaries
- **Multimodal Support**: Seamless combination of text, voice, and images in single entries

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
- [Quick Setup Guide](./docs/QUICK_SETUP.md) - Quick start guide

## 🎯 Key Capabilities

### Diary Creation Modes

1. **Voice Diary**: Record your thoughts, get transcribed and enhanced automatically
2. **Text Diary**: Write directly, get AI-enhanced version with title and feedback
3. **Image Diary**: Upload photos (up to 9), optionally add text or voice
4. **Multimodal Diary**: Combine any of the above - e.g., photos + voice + text

### Processing Features

- **Real-time Progress**: Live updates during voice processing (polling-based, 500ms interval)
- **Parallel Processing**: S3 upload and transcription happen simultaneously
- **Smart Optimization**: Fast path for pure voice diaries, full pipeline for multimodal entries
- **Language Detection**: Automatic language detection and appropriate AI responses

### User Experience

- **Personalized AI**: Uses your name in feedback for a warm, personal touch
- **Edit Anytime**: Edit entries after creation with instant save
- **Audio Playback**: Listen to your voice recordings anytime
- **Image Carousel**: Beautiful image viewing with swipe navigation
- **Multilingual UI**: Full support for Chinese and English interfaces

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

## 👤 Author: Diana Deng

Built with ❤️ for capturing life's meaningful moments

---

## 📝 Recent Updates

### Latest Features (2024-12)

- ✅ **Real-time Progress Bar**: Live progress tracking for voice diary processing
- ✅ **Multimodal Support**: Full support for image + text + voice combinations
- ✅ **Text Input in Image Diaries**: Add text directly when creating image entries
- ✅ **Voice Input in Image Diaries**: Record voice directly in image diary modal
- ✅ **Optimized Processing**: Parallel processing and fast path for pure voice diaries
- ✅ **Presigned URL Upload**: Direct S3 upload bypassing Lambda size limits

### Technical Improvements

- Async task processing with progress polling
- Parallel S3 upload and transcription
- Optimized voice processing pipeline
- Enhanced error handling and user feedback

---

**Note**: This project is currently live on the iOS App Store. For production deployment, ensure all environment variables and AWS credentials are properly configured.
