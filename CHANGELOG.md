# Change Log

All notable changes to the "workspace-manager" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.0.6] - 2025-10-15

### Added
- 🎨 **TDesign Icon Library Integration**: Replaced all UI icons with TDesign icons for a modern, consistent look
- 🌐 **Full Chinese Localization**: All interface text, buttons, tooltips now in Chinese
- ✨ **Enhanced Visual Design**: Updated button styles with TDesign components
- 🔄 **Smooth Animations**: Added loading spinner animations and hover effects
- 📖 **Comprehensive Documentation**: Added complete TDesign integration documentation

### Changed
- **Complete TDesign Migration**: Removed all Codicons and Emoji icons, using only TDesign icons
- **Filter Labels**: Redesigned filter labels as TDesign components with icons
- **Context Menu**: Enhanced right-click menu with TDesign icons and styling
- **Section Headers**: Dynamic headers with TDesign icons instead of emoji
- **Icon Functions**: Rewrote icon generation functions to return TDesign icon HTML
- **CSS Optimization**: Removed 60+ lines of Codicon fallback code
- **Improved Accessibility**: Better icon + text combinations for clarity

### Technical
- Installed `tdesign-icons-vue@0.4.1` package
- Updated Webview HTML template with TDesign icons throughout
- Completely removed Codicon dependencies and fallback styles
- Enhanced CSS with pure TDesign styling patterns (reduced from 793 to 744 lines)
- Modified JavaScript to generate TDesign icon HTML dynamically
- Added proper icon font loading via Webview URIs
- Optimized component structure for better maintainability

### Documentation
- Added `TDESIGN_INTEGRATION.md` - Detailed integration guide
- Added `TDESIGN_INTEGRATION_SUMMARY.md` - Implementation summary
- Added `TDESIGN_QUICKSTART.md` - Quick start guide
- Added `TDESIGN_COMPLETE_REPORT.md` - Complete integration report
- Updated `README.md` with TDesign information
- Updated `CHANGELOG.md` with detailed changes

### Icons Replaced
**UI Components**:
- Search: `t-icon-search`, `t-icon-close`
- Actions: `t-icon-refresh`, `t-icon-rollback`, `t-icon-swap`, `t-icon-setting`
- Locations: `t-icon-laptop`, `t-icon-server`, `t-icon-internet`
- Types: `t-icon-folder`, `t-icon-folder-open`, `t-icon-view-module`
- Views: `t-icon-view-list`, `t-icon-time`, `t-icon-star-filled`, `t-icon-pin-filled`
- Tags: `t-icon-discount`, `t-icon-bookmark`
- Operations: `t-icon-edit`, `t-icon-delete`, `t-icon-jump`
- Status: `t-icon-loading` with rotating animation

**Total**: 26+ different TDesign icons replacing all previous Codicons and Emoji

## [0.0.1] - Initial Release

### Added
- Initial release with workspace management features
- Real VS Code history synchronization via SQLite
- WSL workspace support
- Advanced tagging system
- Location-based organization (Local/WSL/Remote)
- Favorites and pinning functionality
- Modern webview interface
- Search and filtering capabilities
- Auto-sync with configurable intervals
- System tag detection for project types