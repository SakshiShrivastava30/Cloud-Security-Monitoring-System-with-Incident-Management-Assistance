\# Playbook Automation Module



\## 1. Overview



The Playbook Automation module is part of the Cloud Security Monitoring System. It helps manage security response playbooks and execute predefined actions when security incidents occur.



The module supports creating, updating, retrieving, and deleting playbooks, managing actions, executing playbooks, and tracking execution history.



It also supports automatic playbook execution based on incident severity.



\## 2. Technologies Used



\- Java

\- Spring Boot

\- Spring Data JPA

\- Hibernate

\- MySQL

\- Maven

\- REST APIs



\## 3. Features Implemented



\### Playbook Management

\- Create a new playbook.

\- Retrieve all playbooks.

\- Retrieve a playbook by ID.

\- Update playbook details.

\- Delete a playbook.

\- Validate severity and status.

\- Prevent multiple active playbooks for the same severity.



Supported severities:

\- LOW

\- MEDIUM

\- HIGH

\- CRITICAL



Supported statuses:

\- DRAFT

\- ACTIVE

\- INACTIVE



\### Playbook Action Management

\- Add actions to a playbook.

\- Retrieve actions associated with a playbook.

\- Validate action type and configuration.

\- Maintain execution order.

\- Prevent duplicate execution orders within a playbook.



Currently supported action type: `NOTIFICATION`



\### Playbook Execution

\- Execute an active playbook.

\- Execute actions in ascending execution order.

\- Track individual action execution status.

\- Store execution start and completion timestamps.

\- Maintain execution results.

\- Retrieve execution history.



\### Automatic Incident Integration

When an incident is created:



1\. The system checks for an active playbook matching the incident severity.

2\. If a matching playbook exists, it is executed automatically.

3\. If execution succeeds, the incident status changes to `IN\_PROGRESS`.

4\. If no matching playbook exists or execution fails, the incident remains `OPEN`.



\## 4. Project Structure



```text

com.example.demo

|

+-- controller

|   +-- PlaybookController.java

|   +-- PlaybookActionController.java

|   +-- PlaybookExecutionController.java

|   +-- IncidentController.java

|

+-- entity

|   +-- Playbook.java

|   +-- PlaybookAction.java

|   +-- PlaybookExecution.java

|   +-- PlaybookActionExecution.java

|   +-- Incident.java

|

+-- repository

|   +-- PlaybookRepository.java

|   +-- PlaybookActionRepository.java

|   +-- PlaybookExecutionRepository.java

|   +-- PlaybookActionExecutionRepository.java

|   +-- IncidentRepository.java

|

+-- service

&#x20;   +-- PlaybookService.java

&#x20;   +-- PlaybookActionService.java

&#x20;   +-- PlaybookExecutionService.java

&#x20;   +-- IncidentService.java

```



\## 5. REST API Endpoints



Base URL: `http://localhost:8084`



\### Playbook APIs



| Method | Endpoint | Description |

|---|---|---|

| POST | `/api/playbooks` | Create playbook |

| GET | `/api/playbooks` | Get all playbooks |

| GET | `/api/playbooks/{id}` | Get playbook by ID |

| PUT | `/api/playbooks/{id}` | Update playbook |

| DELETE | `/api/playbooks/{id}` | Delete playbook |



\### Playbook Action APIs



| Method | Endpoint | Description |

|---|---|---|

| POST | `/api/playbooks/{playbookId}/actions` | Add action |

| GET | `/api/playbooks/{playbookId}/actions` | Get playbook actions |



\### Playbook Execution APIs



| Method | Endpoint | Description |

|---|---|---|

| POST | `/api/playbooks/{playbookId}/execute` | Execute playbook |

| GET | `/api/playbooks/{playbookId}/executions` | Get execution history |

| GET | `/api/playbooks/executions/{executionId}/actions` | Get action execution history |



The execution API optionally accepts an `incidentId` query parameter.



Example:



`POST /api/playbooks/1/execute?incidentId=11`



\## 6. Database Entities



The module uses the following entities:



\- \*\*Playbook:\*\* Stores playbook details, severity, status, and creation time.

\- \*\*PlaybookAction:\*\* Stores actions associated with a playbook.

\- \*\*PlaybookExecution:\*\* Stores each playbook execution and its overall result.

\- \*\*PlaybookActionExecution:\*\* Stores the execution details of individual actions.

\- \*\*Incident:\*\* Stores incident information and supports automatic playbook integration.



Relationships:



\- One Playbook can have multiple PlaybookActions.

\- One Playbook can have multiple PlaybookExecutions.

\- One PlaybookExecution can have multiple PlaybookActionExecutions.

\- Each PlaybookActionExecution references its corresponding PlaybookAction.

\- A PlaybookExecution can optionally be associated with an Incident.



\## 7. Setup Instructions



\### Prerequisites



\- Java Development Kit

\- MySQL Server

\- Maven wrapper included in the project



\### Database Configuration



Create a MySQL database:



```sql

CREATE DATABASE playbook\_db;

```



Configure the database connection in `Backend/src/main/resources/application.properties`.



Example:



```properties

spring.datasource.url=jdbc:mysql://localhost:3306/playbook\_db

spring.datasource.username=root

spring.datasource.password=${DB\_PASSWORD:}



spring.jpa.hibernate.ddl-auto=update

spring.jpa.show-sql=true



server.port=8084

```



Set your MySQL password through an environment variable before starting the application:



```powershell

$env:DB\_PASSWORD = "your\_mysql\_password"

```



Do not commit actual database credentials to GitHub.



\### Run the Application



Open PowerShell inside the Backend directory and run:



```powershell

.\\mvnw.cmd spring-boot:run

```



The application runs at:



`http://localhost:8084`



\## 8. Validation and Testing



The following scenarios were tested:



\- Successful playbook creation and retrieval.

\- Playbook update and deletion.

\- Invalid playbook name and severity validation.

\- Duplicate active playbook prevention.

\- Invalid action type and empty action configuration validation.

\- Duplicate action execution order prevention.

\- Successful playbook execution.

\- Rejection of inactive playbook execution.

\- Rejection of execution when a playbook has no actions.

\- Automatic playbook execution when an incident is created.

\- Retrieval of execution and action execution history.

\- Verification of persisted records in MySQL.



Expected validation responses include HTTP 400 for invalid requests, HTTP 404 for missing resources, and HTTP 409 for conflicting active playbooks.



\## 9. Current Implementation Limitation



The `NOTIFICATION` action is currently simulated. The execution result is recorded and printed to the application console. Integration with real email, SMS, or external notification services is not yet implemented.



\## 10. Contribution Scope



This contribution focuses on:



\- Playbook entity and repository implementation.

\- Playbook CRUD operations.

\- Playbook action management.

\- Playbook execution engine.

\- Action execution tracking.

\- Execution history APIs.

\- Automatic playbook execution based on incident severity.

\- Integration of playbook execution with incident creation.



Other modules, including authentication and security configuration, are maintained separately within the project.



\---



\*\*Project:\*\* Cloud Security Monitoring System with Incident Management Assistance



\*\*Module:\*\* Playbook Automation

