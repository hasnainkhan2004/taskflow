const mongoose = require('mongoose');
const migrateLegacyData = require('../utils/migrateLegacyData');
const migratePhase2 = require('../utils/phase2Migration');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
    await migrateLegacyData();
    await migratePhase2();
    await Promise.all(
      mongoose.modelNames().map((modelName) => mongoose.model(modelName).createIndexes())
    );
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;