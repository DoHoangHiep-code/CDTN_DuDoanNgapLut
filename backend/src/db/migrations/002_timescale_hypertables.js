'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      "SELECT create_hypertable('weather_measurements', 'time', if_not_exists => TRUE);",
    )
    await queryInterface.sequelize.query(
      "SELECT create_hypertable('flood_predictions', 'time', if_not_exists => TRUE);",
    )
  },

  async down() {
    // TimescaleDB doesn't support a simple drop-hypertable that preserves data in a reversible way.
    // Intentionally left blank.
  },
}

