const DatabaseConnection = require('./database/connection');
const UserRepository = require('./database/repositories/userRepository');
const AuthService = require('./services/authService');

async function test() {
  const database = new DatabaseConnection();
  const db = database.getConnection();
  
  const userRepo = new UserRepository(db);
  const auth = new AuthService(userRepo);

  console.log('\n--- Testing Signup ---');
  const signup = await auth.signup('johndoe', 'john@example.com', 'password123');
  console.log(signup);

  if (signup.success) {
    console.log('\n--- Testing Login ---');
    const login = await auth.login('johndoe', 'password123');
    console.log(login);

    if (login.success) {
      console.log('\n--- Testing Get Profile ---');
      const profile = auth.getUserProfile(login.userId);
      console.log(profile);
    }
  }

  database.close();
}


test();