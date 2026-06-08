# design-system

figma에서 token studio for figma plugin을 통한 자동 push 됩니다.

## Outputs

각 `npm run build` 가 다음을 재생성합니다:

- **Web**: `web/tokens.css`, `web/tokens-dark.css`, `web/tokens.ts` — CSS variables + 타입 안전 TS const
- **Android**: `android/LightColors.kt`, `DarkColors.kt`, `Spacing.kt`, `Typography.kt` — Compose object
- **iOS**: `ios/Assets.xcassets/` + `ios/DS*+Generated.swift` — Xcode Asset Catalog (1143 `.colorset` 디렉토리, light + dark appearances 한 파일에) + 4 DS 접두 accessor enum (`DSColor`, `DSSpacing`, `DSRadius`, `DSFont`)

iOS 출력은 downstream 에서 변환 단계 없이 그대로 소비합니다 — 아래 **Downstream iOS sync** 참고.

## Downstream iOS sync (예시 스크립트)

iOS Swift Package consumer (예: `imin-design-system` 앱) 가 design-system 의 iOS 산출물을 받아오는 3단계 sync 스크립트:

```bash
#!/usr/bin/env bash
set -euo pipefail

REPO_URL="https://github.com/twavetech-frontend/design-system.git"
BRANCH="main"
CACHE_DIR="$(pwd)/tokens-cache"
DEST_GENERATED="Packages/DesignSystem/Sources/DesignSystem/Generated"
DEST_ASSETS="Packages/DesignSystem/Sources/DesignSystem/Resources/Assets.xcassets"

# 1) Sparse-clone the ios/ directory
if [ -d "$CACHE_DIR/.git" ]; then
  git -C "$CACHE_DIR" fetch --depth=1 origin "$BRANCH"
  git -C "$CACHE_DIR" reset --hard "origin/$BRANCH"
else
  rm -rf "$CACHE_DIR"
  git clone --depth=1 --filter=blob:none --sparse --branch "$BRANCH" "$REPO_URL" "$CACHE_DIR"
  git -C "$CACHE_DIR" sparse-checkout set ios
fi

# 2) Copy Asset Catalog + DS accessor files
mkdir -p "$DEST_GENERATED" "$DEST_ASSETS"
find "$DEST_GENERATED" -maxdepth 1 -name "DS*+Generated.swift" -delete
cp "$CACHE_DIR/ios"/DS*+Generated.swift "$DEST_GENERATED/"
rm -rf "$DEST_ASSETS/Colors"
cp -r "$CACHE_DIR/ios/Assets.xcassets/." "$DEST_ASSETS/"

# 3) (Optional) Pretendard 폰트 — design-system 은 vendoring 안 함. 직접 fetch:
# curl -sLfo "$DEST_GENERATED/../Resources/Fonts/Pretendard-Regular.otf" \
#   "https://raw.githubusercontent.com/orioncactus/pretendard/v1.3.9/packages/pretendard/dist/public/static/Pretendard-Regular.otf"

# 4) Validate
swift build
```

### `DSFontRegistration` 의존성

`DSFont+Generated.swift` 의 각 폰트 멤버는 `DSFontRegistration.register()` 를 호출해 첫 접근 시 폰트 등록을 1회 트리거합니다. consumer 는 **같은 module 안에 `enum DSFontRegistration { static func register() { ... } }` 를 자체적으로 제공해야 합니다.**

design-system 은 폰트 자산 (`.otf`) 도, 등록 로직도 vendoring 하지 않습니다 — 토큰만 다룸. 위 sync 스크립트의 step 3 에서 보듯 폰트는 upstream (`orioncactus/pretendard`) 에서 직접 받아 모듈에 추가합니다.

### 마이그레이션 노트 (이전 raw Swift 형태에서)

이전에는 design-system 이 `ColorsLight.swift` / `ColorsDark.swift` / `Spacing.swift` / `Typography.swift` 네 파일을 출력했고, consumer 가 자체적으로 `swift_to_colorsets.py` / `swift_to_ds_tokens.py` 변환기를 거쳐 Asset Catalog + DS accessor 로 만들었습니다. 이제 design-system 이 변환을 흡수하므로 **변환기는 더 이상 필요 없습니다** — `cp -r ios/Assets.xcassets/.` + `cp ios/DS*+Generated.swift` 두 줄로 동기화 완료.
