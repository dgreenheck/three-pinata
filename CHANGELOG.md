# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0]

### Added

- Recursive fracturing—fragments can be refractured multiple times
- Refracture specific options added to `FractureOptions`

### Changed

- `DestructibleMesh.fracture()` return type changed from `THREE.Mesh[]` to `DestructibleMesh[]` to support refracturing

### Fixed

- The README included some old functions/parameters that no longer exist

## [1.0.5]

### Added

- **Refracturing Support**: Fragments can now be fractured multiple times for progressive destruction
  - Added `refracture` options to `FractureOptions` with `enabled`, `maxRefractures`, and `fragmentCount` properties
  - Added `refractureCount` property to `DestructibleMesh` to track generation depth
  - Fragments automatically track their refracture count
- New brick wall demo scene showcasing destruction patterns

### Changed

- Fragment count now automatically adjusts based on whether it's an initial fracture or refracture
- Improved demo scenes with refracturing capabilities

### Fixed

- Various linting errors resolved
- Triangulation bugs fixed

## [1.0.0]

### Added

- **Major v1 Release** 🎉
- Complete rewrite and stabilization of the library
- Voronoi fracturing with 3D and 2.5D modes
- Impact-based fracturing to concentrate fragments around impact points
- Plane slicing in local and world space
- Dual material support (outer surface + internal faces)
- UV mapping for internal faces with configurable scale and offset
- TypeScript support with full type definitions
- Comprehensive documentation and examples
- Interactive demo application

### Changed

- Refactored project structure into monorepo with separate `lib` and `demo` workspaces
- Improved API design for better developer experience
- Enhanced performance and stability

---

## Types of Changes

- `Added` for new features
- `Changed` for changes in existing functionality
- `Deprecated` for soon-to-be removed features
- `Removed` for now removed features
- `Fixed` for any bug fixes
- `Security` in case of vulnerabilities
