# Video Streaming Workflow

```mermaid
graph TD
    A[User Joins System] --> B[Start Welcome Video]
    B --> C{User Speaking?}
    C -->|Yes| D[Switch to Speaking Video]
    C -->|No| E[Play Idle Video]
    E --> F{AI Processing?}
    F -->|Yes| E
    F -->|No| G[AI Response Ready]
    G --> D
    D --> H{More Interactions?}
    H -->|Yes| C
    H -->|No| I[Stop Streaming]
```

## State Transitions

1. **Welcome State**: When user first connects
2. **Idle State**: When user is not speaking
3. **Speaking State**: When user is speaking or AI is responding
4. **Processing State**: When waiting for AI response (uses Idle video)

## Key Features for Seamless Transitions

- **Consistent Encoding**: All videos encoded with same settings
- **Proper GOP Alignment**: GOP size of 50 frames for smooth switching
- **Fast Encoding**: Ultrafast preset with zerolatency tuning
- **Graceful Process Management**: Previous FFmpeg process properly terminated before starting new one
- **Transition Locking**: Prevents multiple simultaneous transitions
- **Looping**: Videos loop continuously to prevent gaps