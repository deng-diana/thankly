# Thankly v1.3.0 Release Notes

## 🎉 Major Feature: Intimate Circles (亲密圈)

### Overview
A brand new social feature that allows users to create private circles with close friends and family, share gratitude diary entries, and build emotional connections together.

### Key Features

#### ✨ **Create & Join Circles**
- Create private circles with custom names
- Generate unique 6-character invite codes
- Join circles using invite codes
- Automatic membership management

#### 📱 **Circle Management**
- View all your circles in a dedicated list
- See member counts and creation dates
- Circle owner badge
- First-time user onboarding guide

#### 📰 **Circle Feed**
- View shared diaries from all circle members
- Chronological feed with real-time updates
- Pull-to-refresh and infinite scroll
- See who shared and when

#### 📤 **Diary Sharing**
- Share diaries to multiple circles at once
- Share directly from diary action sheet
- Multi-select interface for easy sharing
- View and manage share status

#### 🔔 **Smart Push Notifications**
- Real-time notifications when members share
- Rate limiting: Max 3 notifications per day per circle
- Quiet hours: No notifications 22:00-08:00
- Deep linking: Click notification to view shared diary

### Technical Highlights

#### Backend
- **New API Endpoints**: 
  - Circle management (create, join, leave, members)
  - Diary sharing (share, unshare, query shares)
  - Circle feed with pagination
  - Push notification token registration

- **Database Design**:
  - 3 new DynamoDB tables: `circles`, `circle_members`, `diary_shares`
  - Denormalized feed data for optimal performance
  - GSI indexes for efficient querying
  - TTL-based rate limiting

- **Smart Rate Limiting**:
  - DynamoDB-based (no Redis required)
  - Automatic cleanup via TTL
  - Per-user per-circle daily limits

#### Frontend
- **7 New Components**:
  - CircleListScreen (main circle list)
  - CircleFeedScreen (shared diary feed)
  - CircleOnboarding (first-time guide)
  - CreateCircleModal (create circles)
  - JoinCircleModal (join circles)
  - CircleFeedCard (feed item display)
  - CircleShareSelector (multi-select sharing)

- **Performance Optimizations**:
  - FlatList virtualization (removeClippedSubviews)
  - React.memo for feed cards
  - useCallback for render functions
  - Optimized batch rendering (maxToRenderPerBatch: 10)

- **i18n Support**:
  - 120+ new translation keys
  - Full Chinese/English support

### Architecture Decisions

1. **Denormalization**: Feed data is denormalized in `diary_shares` table to eliminate JOIN queries and improve feed performance

2. **Rate Limiting**: DynamoDB-based rate limiting allows MVP without Redis infrastructure

3. **Non-blocking Notifications**: Push failures don't affect share operations

4. **MVP Scope**: 
   - Deferred features: Share from create flows (optional)
   - Focus: Core sharing via action sheet (simpler UX)

### Security & Privacy

- JWT-based authentication for all Circle APIs
- Circle membership verification for all operations
- Invite codes: 6-character uppercase alphanumeric
- Ownership validation for sensitive operations

### Version Info

- **App Version**: 1.3.0
- **iOS Build**: 7
- **Android Version Code**: 8
- **Release Date**: 2026-01-30

### Code Quality

- ✅ Zero linter errors
- ✅ Full TypeScript coverage
- ✅ React Hooks best practices (proper dependencies)
- ✅ Memory leak prevention (cleanup functions)
- ✅ Comprehensive error handling
- ✅ Consistent code style

### Commits Summary

**Week 1: Backend Foundation (3 commits)**
- Database schema and services
- API endpoints and authentication
- Rate limiting infrastructure

**Week 2: Frontend Pages (5 commits)**
- Circle list and feed screens
- Create/join modals
- Onboarding flow
- Navigation integration

**Week 3: Sharing & Notifications (3 commits)**
- Diary sharing selector
- Push notification system
- Deep linking

**Week 4: Quality & Performance (3 commits)**
- Code review fixes
- Performance optimizations
- Release preparation

**Total**: 14 commits, ~3,540 lines of new code

### Testing Checklist

See separate testing documentation for detailed test cases.

### Known Limitations (MVP)

1. **Timezone Support**: Quiet hours use UTC (Phase 2: user timezone)
2. **Push Delivery**: Log-based for MVP (Phase 2: Expo Push Service)
3. **Audio Playback**: Not yet implemented in feed cards (Week 3 TODO)
4. **Image Preview**: Not yet implemented in feed cards (Week 3 TODO)

### Migration Notes

#### For Deployment

1. **Create DynamoDB Tables**:
   ```bash
   python backend/scripts/create_notification_tables.py
   ```

2. **Update Environment Variables**:
   - Ensure `IS_LOCAL_DEV = false` in production
   - Verify AWS region configuration
   - Confirm table name conventions

3. **Test Push Notifications**:
   - Physical devices only (simulator not supported)
   - Verify rate limiting
   - Test quiet hours enforcement

### Next Steps (Future Releases)

- Circle management features (rename, transfer ownership)
- Dynamic filtering in feed
- Supplementary sharing (share after initial post)
- Share status display in diary cards
- User timezone support for quiet hours
- Full Expo Push Service integration
- Audio playback in feed
- Image preview in feed

---

**Breaking Changes**: None

**Upgrade Path**: Seamless OTA update for existing users

**Backward Compatibility**: ✅ Fully compatible with v1.2.x
