# 멀티 플랫폼 토큰 빌드 설계

- 작성일: 2026-05-06
- 대상 레포: `twavetech-frontend/design-system`
- 상태: 설계 합의 완료, 구현 계획 수립 예정

## 배경

현재 design-system 레포는 Figma → Token Studio Pro → GitHub 직접 push로 `tokens.json`이 갱신되며, `build.js`(Style Dictionary v5 + sd-transforms)가 web용 CSS Variables (`build/css/tokens.css`, `tokens-dark.css`) 만 생성한다. iOS·Android 네이티브 앱이 같은 토큰을 직접 import 할 수 있도록 플랫폼별 산출물을 추가하고, 디자이너의 Figma push 시 GitHub Actions 가 자동으로 빌드·커밋하도록 만든다.

## 목표

- iOS / Android / Web 세 플랫폼 모두 네이티브 언어로 된 토큰 파일을 생성한다.
- Figma 에서 Token Studio "Push" 한 번으로 모든 플랫폼 산출물이 main 브랜치에 자동 갱신된다.
- 토큰 명명·구조는 plat폼별 관습을 따른다.

## 비목표 (스코프 밖, Phase 2)

- SPM / Maven / npm 패키지 publish (현재는 raw 파일만 생성, 소비측은 git submodule / subtree / 수동 복사로 가져감)
- `sync-to-agent.js` 통한 figma-design-agent 동기화 자동화 (별도 레포라 GHA 환경에서 접근 불가, 로컬 실행 유지)
- design-system-docs 자동 갱신 (별도 레포)
- 토큰 명명 중첩 구조 (`Color.text.primary`) — 일단 평면, 필요 시 마이그레이션

## 폴더 구조

```
design-system/
├── tokens.json                  ← Token Studio가 Figma에서 push (변경 없음)
├── tokens-transformed.json      ← (기존) 보존
├── build.js                     ← 모든 플랫폼 빌드 진입점 (확장)
├── package.json                 ← scripts.build 갱신
├── ios/
│   ├── ColorsLight.swift
│   ├── ColorsDark.swift
│   ├── Spacing.swift
│   └── Typography.swift
├── android/
│   ├── LightColors.kt
│   ├── DarkColors.kt
│   ├── Spacing.kt
│   └── Typography.kt
├── web/
│   ├── tokens.css               ← 기존 build/css/tokens.css 이전
│   ├── tokens-dark.css          ← 기존 build/css/tokens-dark.css 이전
│   └── tokens.ts                ← 신규
├── build/                       ← 임시 디렉토리, 산출물 위치 아님 (정리)
└── .github/workflows/
    └── build-tokens.yml
```

기존 `build/css/` 산출물 위치는 `web/` 으로 이전한다. 이미 이 경로를 import 하던 곳이 있으면 함께 갱신해야 한다 (확인 필요).

## 자동화 흐름

```
Figma 변경
   ↓
Token Studio "Push" 버튼
   ↓
GitHub: tokens.json 커밋 (Token Studio Pro 직접 push)
   ↓
GitHub Actions (paths: tokens.json 만 감지)
   ↓
npm ci && npm run build
   ↓
ios/ android/ web/ 산출물 갱신
   ↓
github-actions[bot] 가 [skip ci] 메시지로 자동 커밋·푸시
```

### 무한 루프 방지

두 겹 안전장치:

1. 워크플로 트리거 `paths: ['tokens.json']` 으로 좁힘 — 봇이 커밋한 산출물 변경 (`ios/`, `android/`, `web/`) 은 트리거되지 않음.
2. 봇 커밋 메시지에 `[skip ci]` 포함 — 다른 트리거가 추가돼도 CI 재실행 차단.

## 토큰 명명

**평면 camelCase** 로 통일. Style Dictionary 의 `name/camel` 변환 (sd-transforms 그룹의 기본 동작)을 따른다.

| 토큰 경로 (Token Studio) | 출력 식별자 |
|---|---|
| `Colors / Text / text-primary (900)` | `colorsTextTextPrimary900` |
| `Spacing / s100` | `spacingS100` |
| `Radius / r100` | `radiusR100` |

기존 web CSS 의 hybrid 명명 (`--colors-text-textPrimary-900`, `name/kebab-camel` 커스텀 transform) 은 유지 — 이미 소비처가 있을 수 있어 호환성 우선. iOS/Android 신규 출력만 sd-transforms 기본 `name/camel` 로 평면 camelCase.

## 플랫폼별 산출물 사양

### iOS — SwiftUI

라이트/다크는 별도 파일 두 개로 분리. 소비측이 `@Environment(\.colorScheme)` 또는 자체 헬퍼로 둘 중 하나를 선택해 사용한다.

**`ios/ColorsLight.swift`**
```swift
import SwiftUI

public extension Color {
    static let colorsTextTextPrimary900 = Color(red: 0.07, green: 0.09, blue: 0.15)
    static let colorsBgBgBrandPrimary = Color(red: 0.34, green: 0.27, blue: 0.91)
    // ...
}
```

**`ios/ColorsDark.swift`**

같은 식별자, 다른 RGB 값. `extension`이 충돌하므로 별도 namespace 가 필요 — 두 가지 패턴 중 택일:

- (A) struct namespace: `LightColors.colorsTextPrimary` / `DarkColors.colorsTextPrimary`
- (B) `Color(light:dark:)` initializer 로 한 파일에 합쳐 trait 자동 처리

→ **(A) 채택.** 빌드 단순성과 사용자가 명시한 "별도 파일" 흐름에 부합. 소비측에서 `colorScheme == .dark ? DarkColors.x : LightColors.x` 로 선택.

```swift
public enum LightColors {
    public static let colorsTextTextPrimary900 = Color(red: 0.07, ...)
    // ...
}
```

**`ios/Spacing.swift`** (라이트/다크 공통)
```swift
import CoreGraphics

public enum Spacing {
    public static let spacingS100: CGFloat = 4
    // ...
}

public enum Radius {
    public static let radiusR100: CGFloat = 4
    // ...
}
```

**`ios/Typography.swift`**
```swift
import SwiftUI

public extension Font {
    static let textBodyM = Font.system(size: 16, weight: .regular)
    // ...
}
```

`Font.system` 으로 시작 — fontFamily 토큰이 시스템 폰트 외 값이면 `Font.custom` 으로 분기 (전사 폰트 자산 관리는 별도 이슈).

### Android — Jetpack Compose

**`android/LightColors.kt`**
```kotlin
package com.imin.designsystem.tokens

import androidx.compose.ui.graphics.Color

object LightColors {
    val colorsTextTextPrimary900 = Color(0xFF131722)
    // ...
}
```

**`android/DarkColors.kt`** — 같은 식별자, 다른 값

**`android/Spacing.kt`**
```kotlin
import androidx.compose.ui.unit.dp

object Spacing {
    val spacingS100 = 4.dp
    // ...
}
```

**`android/Typography.kt`**
```kotlin
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

object Typography {
    val textBodyM = TextStyle(fontSize = 16.sp, fontWeight = FontWeight.Normal)
    // ...
}
```

소비측에서 `MaterialTheme` colorScheme 분기 시 `LightColors` / `DarkColors` 중 선택해 매핑.

패키지명 `com.imin.designsystem.tokens` 는 잠정 — 실제 앱 패키지 정해지면 변경.

### Web — CSS Variables + TypeScript

**`web/tokens.css`** / **`web/tokens-dark.css`** — 기존 build/css/ 산출물을 위치만 이동. 내용·셀렉터(`:root`, `[data-theme="dark"]`) 변경 없음.

**`web/tokens.ts`** (신규)
```ts
export const colors = {
  light: {
    colorsTextTextPrimary900: '#131722',
    // ...
  },
  dark: {
    colorsTextTextPrimary900: '#FFFFFF',
    // ...
  },
} as const;

export const spacing = {
  spacingS100: 4,
  // ...
} as const;

export const radius = { /* ... */ } as const;

export const typography = {
  textBodyM: { fontSize: 16, fontWeight: 400, lineHeight: 24 },
  // ...
} as const;

export type ColorToken = keyof typeof colors.light;
export type SpacingToken = keyof typeof spacing;
```

`as const` 로 리터럴 타입 추론 → 컴포넌트 prop 에 그대로 활용.

## 빌드 파이프라인 변경

`build.js` 가 단일 진입점. Style Dictionary `platforms` 에 ios/android/web 추가.

- **css**: 기존 light/dark 두 SD 인스턴스 유지, `buildPath` 만 `build/css/` → `web/`.
- **ios-swift-class**: SD 빌트인 `ios-swift/class.swift` format + 커스텀 transform group (`name/camel`, `color/UIColorSwift` 또는 `color/SwiftUIColor`). Color 는 light/dark 두 번 빌드, Spacing/Radius/Typography 는 한 번.
- **android-compose**: 빌트인에 Compose 직접 지원 format 이 없어 **커스텀 format** 작성 (또는 `compose/object` format 직접 정의). Color light/dark 두 번, Spacing/Typography 한 번.
- **web-ts**: 커스텀 format 으로 `tokens.ts` 생성. light/dark 객체를 한 파일에 합쳐 출력 (분리하지 않음 — TS 는 한 파일이 더 편함).

`package.json` scripts:

```json
{
  "build": "node build.js",
  "build:all": "node build.js && node sync-to-agent.js --out ../figma-design-agent/ds"
}
```

기존 `build:all` 의 sync-agent 단계는 로컬 사용자 환경 전용 — CI 에선 `npm run build` 만 호출.

## GitHub Actions 워크플로

**`.github/workflows/build-tokens.yml`**

```yaml
name: Build Tokens
on:
  push:
    branches: [main]
    paths:
      - 'tokens.json'
permissions:
  contents: write
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - name: Commit token outputs
        run: |
          git config user.name 'github-actions[bot]'
          git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
          git add ios/ android/ web/
          if git diff --staged --quiet; then
            echo "No token output changes"
            exit 0
          fi
          git commit -m "chore(tokens): rebuild from Figma push [skip ci]"
          git push
```

자동 커밋 — design-system 은 토큰 전용 레포라 PR 단계 가치 없음. 잘못된 토큰은 디자이너가 다시 push 하면 그대로 덮임.

## 리스크 / 검증 포인트

- **기존 `build/css/` 소비처 확인 필요** — 현재 어디서 import 하고 있는지 그렙 후 `web/` 경로로 일괄 변경. (figma-design-agent, design-system-docs 등 외부 레포는 별도)
- **`sync-to-agent.js`** 가 `tokens-transformed.json` 또는 `build/css/` 를 읽고 있다면 web/ 이전과 함께 경로 갱신.
- **Compose Color format 커스텀** — Style Dictionary 에 빌트인 없어 직접 작성. 색상 hex → `Color(0xFFRRGGBB)` 변환, alpha 처리 (`#RRGGBBAA` → `0xAARRGGBB` 순서 주의).
- **Typography 토큰의 fontFamily** 가 Figma 시스템 폰트가 아닌 경우 — 우선 출력만 하고, 실제 폰트 자산 번들링은 phase 2.
- **CI permissions** — `permissions: contents: write` 와 default `GITHUB_TOKEN` 으로 push 가능. branch protection 에 main 직접 push 금지가 걸려 있으면 PAT 필요.

## 마이그레이션 영향

- 기존 `build/css/tokens.css` 경로를 import 하는 외부 코드가 있으면 깨짐. 첫 PR 머지 전에 외부 레포(figma-design-agent, design-system-docs) 에서 이 경로 사용 여부 확인.
- `tokens-transformed.json` 은 현재 그대로 두지만 새 빌드 파이프라인에서 더 이상 필요 없으면 phase 2 에서 정리 검토.

## 다음 단계

이 설계가 합의되면 writing-plans 로 단계별 구현 계획을 작성한다.
