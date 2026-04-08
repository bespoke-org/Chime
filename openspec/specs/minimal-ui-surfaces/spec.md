## ADDED Requirements

### Requirement: Home page acts as a direct entry surface
The system SHALL present the home page as a concise entry point into the product with product identity, a short functional description, and a primary action to enter creator flows. The home page SHALL NOT depend on promotional showcase sections or marketing-style product demos to explain the product.

#### Scenario: Visitor opens the home page
- **WHEN** a visitor navigates to the home page
- **THEN** the system displays the product name, a short functional description, and a primary action that leads directly to creator sign-in or the dashboard depending on session state

#### Scenario: Visitor views the full home page
- **WHEN** a visitor scrolls the home page
- **THEN** the system does not show promotional feature grids, respondent showcase panels, or other ad-like sections that are not required for entry into the product

### Requirement: Creator shell and dashboard prioritize management actions
The system SHALL present authenticated creator surfaces with concise identity, navigation, and management actions. Dashboard content SHALL focus on form creation, form status, and response access without promotional taglines or decorative overview blocks.

#### Scenario: Creator opens the authenticated shell
- **WHEN** an authenticated creator navigates to a creator route
- **THEN** the system shows app identity, essential navigation, and sign-out access without promotional tagline text in the header

#### Scenario: Creator opens the dashboard
- **WHEN** an authenticated creator opens the dashboard
- **THEN** the system emphasizes creating forms, viewing existing forms, and checking status data without marketing-style hero framing or non-essential decorative cards

#### Scenario: Creator has no forms yet
- **WHEN** an authenticated creator opens an empty dashboard
- **THEN** the system shows a concise empty state that explains the next action without sales-oriented or poetic product language
