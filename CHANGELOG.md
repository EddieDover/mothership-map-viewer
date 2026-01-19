
## [1.5.0](https://github.com/EddieDover/mothership-map-viewer/compare/v1.4.3...v1.5.0) (2026-01-19)


### Features

* active viewers now automatically updates when players log in/out ([341f562](https://github.com/EddieDover/mothership-map-viewer/commit/341f56250149e5ff63eea0a1e3a980f31bf81925))
* add ability to hide/show room labels without hiding rooms ([2a918b1](https://github.com/EddieDover/mothership-map-viewer/commit/2a918b1a79865badf8a46481cfb02748611964ed))
* add visibility filter ([6c0ffc8](https://github.com/EddieDover/mothership-map-viewer/commit/6c0ffc82bde6ef20cfa6cfce340ed5b3b416425d))
* add visual indicator of stairwells and elevator shafts ([4073713](https://github.com/EddieDover/mothership-map-viewer/commit/40737135e60506e5cd5801f4a1269d9320903ede))
* added 3D Map support with multiple floors ([3935d5d](https://github.com/EddieDover/mothership-map-viewer/commit/3935d5dd6b1ff622235bde649abbc58f4f3578ce))
* added align button for sets of stairs or elevator markers ([7cf4e41](https://github.com/EddieDover/mothership-map-viewer/commit/7cf4e41c2d6644ef5dcdd4ed7b4418f3604703a0))
* added center view button ([3052026](https://github.com/EddieDover/mothership-map-viewer/commit/3052026b054099325b8e6fc44a68190df1918911))
* added Room Settings dialog so GMs can change room colors in 3D view ([d8a6d48](https://github.com/EddieDover/mothership-map-viewer/commit/d8a6d481defe19406fd37581202320bc20c5a824))
* added stairs icon ([1705baa](https://github.com/EddieDover/mothership-map-viewer/commit/1705baa9757d085098a0968cee04708e163e15fa))
* hidden room labels are still displayed with parenthesis for GMs ([85da6d8](https://github.com/EddieDover/mothership-map-viewer/commit/85da6d8d6df4ed8ca1a37807879f5cd64d563db6))
* maps are preserved on refresh ([bc63ff9](https://github.com/EddieDover/mothership-map-viewer/commit/bc63ff9a8ac7cc46328e75320415a15b4d84f5a7))
* **site:** add visibility toggle for room labels in the map creator ([a1037a9](https://github.com/EddieDover/mothership-map-viewer/commit/a1037a91e7cb5194a13ce02a8e1ac67d1e3db47c))
* **site:** added loader ([dfde4f6](https://github.com/EddieDover/mothership-map-viewer/commit/dfde4f6a27d95192eb2dfe7e2d5b13d9f522677a))
* **site:** added undo/redo support to map editor ([9cf8b08](https://github.com/EddieDover/mothership-map-viewer/commit/9cf8b0889d421e05cbdf817f2f28874df1d061ea))

## [1.4.3](https://github.com/EddieDover/mothership-map-viewer/compare/v1.4.2...v1.4.3) (2025-11-06)

- Bumping version to kickstart Foundry deployments, since the module was verified.

## [1.4.2](https://github.com/EddieDover/mothership-map-viewer/compare/v1.4.1...v1.4.2) (2025-10-21)

### Features

- added French language and system support ([b9c0303](https://github.com/EddieDover/mothership-map-viewer/commit/b9c0303277d19910cb6d8721ff4c25e9410491c1))

## [1.4.1](https://github.com/EddieDover/mothership-map-viewer/compare/v1.4.0...v1.4.1) (2025-10-12)

### Features

- added in-room labels ([f2b1a65](https://github.com/EddieDover/mothership-map-viewer/commit/f2b1a65dd9461333dfaea180ae1b3462245159bf))
- **site:** add room label rendering and visibility controls ([b22e014](https://github.com/EddieDover/mothership-map-viewer/commit/b22e0141f745bf0597947d4250ea80c7ac260b34))
- **site:** add version information display to site footer ([c6d7987](https://github.com/EddieDover/mothership-map-viewer/commit/c6d7987126fea821a4bcba8124303544835deb1d))

### Bug Fixes

- **site:** corrected JSON export ([8299989](https://github.com/EddieDover/mothership-map-viewer/commit/8299989f539db045c889c7178e3cd1b7723213ee))
- **site:** delete/backspace now correctly removes standalone markers and labels ([13fbe15](https://github.com/EddieDover/mothership-map-viewer/commit/13fbe15420ef3129382038900f0d57339ae56dd1))
- **site:** fixed hallway icon in selected room panel ([a7a8565](https://github.com/EddieDover/mothership-map-viewer/commit/a7a8565e30db8a367dd7595dc0fd7b6b421e945a))

## [1.4.0](https://github.com/EddieDover/mothership-map-viewer/compare/v1.3.2...v1.4.0) (2025-10-12)

### Features

- add multi-map support with selector and delete functionality ([8bee990](https://github.com/EddieDover/mothership-map-viewer/commit/8bee990be9acc87f975e044b6655119dc7dbb735))
- add rotation functionality for markers ([2bf1fb5](https://github.com/EddieDover/mothership-map-viewer/commit/2bf1fb580b42f8c00695bd064a9c94a45b2aef1f))
- **docs:** add new SVG marker and tool icons for enhanced visual representation ([f6e2274](https://github.com/EddieDover/mothership-map-viewer/commit/f6e2274a685afce3a520297752756c2e1a160060))
- implement SVG path definitions for room and hallway markers ([0651526](https://github.com/EddieDover/mothership-map-viewer/commit/06515263f8b9472f481f206042c94f8e32addb8b))
- **map:** implement rotation functionality for markers and update UI interactions ([f08862e](https://github.com/EddieDover/mothership-map-viewer/commit/f08862e0e3b563ff483df49e7888d7d4f5bc415f))
- **site:** add SVG path definitions for room and hallway markers ([0443a0b](https://github.com/EddieDover/mothership-map-viewer/commit/0443a0bcada1d52ae59d72561b724e964b3f11bf))
- **site:** add validation for map name ([e348da3](https://github.com/EddieDover/mothership-map-viewer/commit/e348da31e14cb5fd20411a16202c2b46f5eaab67))

### Bug Fixes

- fixed logic to determine next available ID for standalone markers and labels ([79a99c7](https://github.com/EddieDover/mothership-map-viewer/commit/79a99c73b0800149e73bb9d3cf6620fcdd31c8b2))
- standalone labels now save into localStorage properly ([90b94c5](https://github.com/EddieDover/mothership-map-viewer/commit/90b94c58dff6dd82d16767c1501e288f305d33a6))

## [1.3.2](https://github.com/EddieDover/mothership-map-viewer/compare/v1.3.1...v1.3.2) (2025-10-11)

### Features

- added more button links ([1983f4a](https://github.com/EddieDover/mothership-map-viewer/commit/1983f4a131af378cc05031ee06f132ec5e4a1408))
- **site:** add 'New Map' button and localStorage functionality for map management ([a19579e](https://github.com/EddieDover/mothership-map-viewer/commit/a19579e57e1f7d10a2c4f09c569b61ab6010496c))
- **site:** add tool info panel with context-sensitive instructions ([4ebf3f2](https://github.com/EddieDover/mothership-map-viewer/commit/4ebf3f2e2c06ad732a326d1b123d999beab1ff71))

## [1.3.1](https://github.com/EddieDover/mothership-map-viewer/compare/v1.3.0...v1.3.1) (2025-10-11)

### Misc

- Consolidated duplicated code in both the site and foundry module. Reduces the final code output by about 10K and helps me keep things less complex for development purposes.

## [1.3.0](https://github.com/EddieDover/mothership-map-viewer/compare/v1.2.0...v1.3.0) (2025-10-11)

### Features

- player list shows character names and character sheets if clicked ([e023b4c](https://github.com/EddieDover/mothership-map-viewer/commit/e023b4cc83c8b127e383f4fa2d2e4761da93a61a))
- **site:** added wiki link to sidebar ([80f99a8](https://github.com/EddieDover/mothership-map-viewer/commit/80f99a87c4f73d9c13d2530af470e505786d54dd))

### Bug Fixes

- adding changelog and readme to build for people using module managers ([5d8eee8](https://github.com/EddieDover/mothership-map-viewer/commit/5d8eee802ae105217f76323fcda928b517ef199e))

## [1.2.0](https://github.com/EddieDover/mothership-map-viewer/compare/v1.1.0...v1.2.0) (2025-10-10)

### Features

- added dotted walls ([37a5250](https://github.com/EddieDover/mothership-map-viewer/commit/37a525084f0c65003e29e8388dd88084f24d7d3b))
- added ladder markers ([2a577e0](https://github.com/EddieDover/mothership-map-viewer/commit/2a577e06f6fb81e902cadfcb6366dd7d55660fa2))
- added standalone labels ([277c0ba](https://github.com/EddieDover/mothership-map-viewer/commit/277c0baf1953c691031c883fb42a0ef5daa01019))
- added standalone map markers ([91aa152](https://github.com/EddieDover/mothership-map-viewer/commit/91aa15270617be40d3458c4702f880fa606c2777))

### Bug Fixes

- adjusted margin to allow placing room markers on walls ([b264325](https://github.com/EddieDover/mothership-map-viewer/commit/b2643256aecc5ddedf1f9a7421c2994048f4dca7))
- optimize canvas zoom event handling for improved performance ([e6ed609](https://github.com/EddieDover/mothership-map-viewer/commit/e6ed6099772b31c865c4c8d086f32e8edc569bcc))

## [1.1.0](https://github.com/EddieDover/mothership-map-viewer/compare/v1.0.0...v1.1.0) (2025-10-10)

### Features

- New Markers ([1b47a3a](https://github.com/EddieDover/mothership-map-viewer/commit/1b47a3a1da50159586d2897b4a12fd7c3192c55a))
  - Room
    - Airlock
    - Elevator
  - Hallway
    - Airlock

- Custom Walls ([eed0c35](https://github.com/EddieDover/mothership-map-viewer/commit/eed0c35cdfc6e615d59c7e59029d3c7da95dba2d))
- **site:** add room overlap checking when creating new rooms ([9a308a6](https://github.com/EddieDover/mothership-map-viewer/commit/9a308a65dc146d1ba5c205ed85fc03498c5422ba))

### Bug Fixes

- hallway visibility should not affect endpoint visibility ([15bb89c](https://github.com/EddieDover/mothership-map-viewer/commit/15bb89cacf82e70eeaa0cd1a7e1fb6ce6f318dd9))
- **site:** new hallways/rooms are immediately selected after creation ([acf8669](https://github.com/EddieDover/mothership-map-viewer/commit/acf8669cefeae372e44d9b79fe3551aeed38cfb8))
- **site:** double-clicking a room from select mode will autofocus the label input ([708a7b6](https://github.com/EddieDover/mothership-map-viewer/commit/708a7b6f7b5340d7b18f9e875827b2d9638eb6f5))
- **site:** update marker selector section visibility and refresh item details on selection ([4f80c07](https://github.com/EddieDover/mothership-map-viewer/commit/4f80c07a309feb21513580fdb73e8fae047dd30c))

## 1.0.0 (2025-10-09)

First Version Release
