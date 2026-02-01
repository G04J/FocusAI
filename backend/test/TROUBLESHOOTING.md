# Test Troubleshooting Guide

If you're seeing test failures, here are some common issues and solutions:

## Common Issues

### 1. Module Not Found Errors
If you see "Cannot find module" errors:
```bash
npm install
```

Make sure Jest and all dependencies are installed:
```bash
npm install --save-dev jest
```

### 2. Database Connection Issues
The tests use an in-memory database (`:memory:`), so they should work independently. If you see database errors:
- Check that `better-sqlite3` is installed
- Verify the test database helper is creating tables correctly

### 3. Test Failures Related to Session Creation
If tests fail when creating sessions:
- Check that session data format matches expectations (camelCase vs snake_case)
- Verify foreign key constraints (user must exist before creating session)

### 4. Async/Await Issues
Some operations are async (like bcrypt password hashing in AuthService):
- Make sure to use `await` when calling async functions
- Check that tests using async functions are properly marked as `async`

## Running Specific Tests

To debug a specific test file:
```bash
npm test -- validators.test.js
npm test -- authService.test.js
npm test -- sessionService.test.js
```

To run a single test:
```bash
npm test -- -t "should sign up a new user successfully"
```

## Getting Detailed Output

For more verbose output:
```bash
npm test -- --verbose
```

For even more details:
```bash
npm test -- --verbose --no-coverage
```

## Checking Test Structure

Each test file should:
1. Set up test database in `beforeEach`
2. Clean up in `afterEach`
3. Test both positive and negative cases
4. Use descriptive test names

## Common Test Patterns

### Testing Async Functions
```javascript
test('should handle async operation', async () => {
  const result = await asyncFunction();
  expect(result.success).toBe(true);
});
```

### Testing Error Cases
```javascript
test('should return error for invalid input', () => {
  const result = functionToTest(invalidInput);
  expect(result.success).toBe(false);
  expect(result.error).toBeDefined();
});
```

## Getting Help

If tests are still failing:
1. Run a single test file to isolate the issue
2. Check the error message carefully
3. Verify the test expectations match the actual implementation
4. Check that database schema matches between test and production
