# Plan Creation Stage

Based on our full exchange during exploration, produce a markdown plan document.

## Your Goal

Create a clear, actionable implementation plan that:
- Breaks down the feature into concrete, testable steps
- Tracks progress with visual status indicators
- Keeps scope minimal and focused on what was explicitly discussed
- Integrates elegantly with existing codebase

## Requirements

- **Clear steps**: Each step should be specific, modular, and achievable
- **Status tracking**: Use emoji indicators (🟩 Done / 🟨 In Progress / 🟥 To Do)
- **Progress tracking**: Include overall percentage at the top (update as you go)
- **No scope creep**: Only include what was explicitly clarified in exploration
- **Elegant integration**: Steps should fit seamlessly into existing architecture

## Markdown Template

```markdown
# Feature Implementation Plan

**Overall Progress:** `0%`

## TLDR
[2-3 sentence summary of what we're building and why]

## Critical Decisions
Key architectural/implementation choices made during exploration:
- **Decision 1**: [choice] - [brief rationale]
- **Decision 2**: [choice] - [brief rationale]

## Tasks

- [ ] 🟥 **Step 1: [Name]**
  - [ ] 🟥 Subtask 1.1: [specific action]
  - [ ] 🟥 Subtask 1.2: [specific action]

- [ ] 🟥 **Step 2: [Name]**
  - [ ] 🟥 Subtask 2.1: [specific action]
  - [ ] 🟥 Subtask 2.2: [specific action]

...
```

## Important Notes

- This is still NOT implementation time - just planning
- Keep it minimal and focused
- No assumptions beyond what was explicitly discussed
- Plan should be ready for `/execute` stage

Once plan is created and user approves, you'll move to `/execute` stage for actual implementation.
