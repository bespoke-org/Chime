## ADDED Requirements

### Requirement: Responses are named by their identity values
The system SHALL show the values of the identity fields a response answered, joined by ` · ` in form order, as the heading of its row in the responses list and as the title of its response page. A response without identity values SHALL keep its number as the heading. The response page SHALL show the response number and submission date under an identity title.

#### Scenario: Response with a name and a handle
- **WHEN** a creator opens the responses list of a form whose response answered the identity fields "Ada Lovelace" and "@ada"
- **THEN** the row heading reads "Ada Lovelace · @ada"

#### Scenario: Response without identity
- **WHEN** a creator opens a response that answered no identity field
- **THEN** the page title shows the response number and date as before
