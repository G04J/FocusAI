# Test Suite

This directory contains comprehensive unit tests for the FocusAI backend.

## Test Structure

```
test/
├── helpers/
│   └── testDb.js              # Test database setup utility
├── repositories/
│   ├── userRepository.test.js
│   └── sessionRepository.test.js
├── services/
│   ├── authService.test.js
│   └── sessionService.test.js
└── utils/
    └── validators.test.js
```

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in watch mode
```bash
npm run test:watch
```

### Run tests with coverage
```bash
npm run test:coverage
```

### Run a specific test file
```bash
npm test -- validators.test.js
```

## Test Coverage

The test suite covers:

- **Validators**: Email, username, password, and session data validation
- **UserRepository**: User CRUD operations, existence checks
- **SessionRepository**: Session CRUD operations, status updates, statistics
- **AuthService**: Signup, login, token generation and verification, user profiles
- **SessionService**: Session lifecycle management (create, start, pause, resume, stop, complete), updates, deletion, statistics

## Test Database

Tests use an in-memory SQLite database (`:memory:`) that is created fresh for each test suite. This ensures:
- Tests are isolated and don't affect each other
- Tests run quickly
- No cleanup of test data is required
- Tests are repeatable

## Writing New Tests

When adding new tests:

1. Follow the existing test structure and naming conventions
2. Use the `TestDatabase` helper for database-dependent tests
3. Ensure tests are isolated and can run independently
4. Include both positive and negative test cases
5. Test edge cases and error conditions
