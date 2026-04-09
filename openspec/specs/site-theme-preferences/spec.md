## ADDED Requirements

### Requirement: Site supports light, dark, and system theme modes
The system SHALL support light and dark themes across site surfaces and SHALL use the system color scheme when the active appearance preference is `system`.

#### Scenario: Visitor has no explicit theme preference
- **WHEN** a visitor opens the site without a saved appearance preference
- **THEN** the system uses the device's current color scheme

#### Scenario: User selects dark mode
- **WHEN** a user selects the dark appearance mode
- **THEN** the system applies the dark theme across the site

#### Scenario: User selects light mode
- **WHEN** a user selects the light appearance mode
- **THEN** the system applies the light theme across the site

#### Scenario: User selects system mode
- **WHEN** a user selects the system appearance mode
- **THEN** the system follows the device color scheme instead of forcing light or dark

### Requirement: Creator can manage appearance from a settings page
The system SHALL provide an authenticated creator Settings page in creator navigation and SHALL allow the creator to choose Light, Dark, or System appearance mode from that page.

#### Scenario: Creator opens settings
- **WHEN** an authenticated creator opens the Settings page
- **THEN** the system shows an appearance control with Light, Dark, and System options

#### Scenario: Creator updates appearance preference
- **WHEN** an authenticated creator changes the appearance setting in the Settings page
- **THEN** the system applies the selected mode across the site

#### Scenario: Unauthenticated user opens creator settings
- **WHEN** an unauthenticated user attempts to open the creator Settings page
- **THEN** the system requires authentication before showing settings

### Requirement: Theme choice persists for the current browser
The system SHALL remember the selected appearance preference for the current browser so it continues to apply across page reloads and navigation.

#### Scenario: User navigates after changing theme
- **WHEN** a user changes the appearance preference and opens another page in the same browser
- **THEN** the system keeps the selected appearance mode active

#### Scenario: User reloads after changing theme
- **WHEN** a user reloads the site after selecting an appearance preference
- **THEN** the system restores the same preference in that browser
