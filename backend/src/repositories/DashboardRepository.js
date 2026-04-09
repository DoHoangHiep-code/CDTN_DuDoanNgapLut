const { QueryTypes } = require('sequelize')

class DashboardRepository {
  /**
   * @param {{sequelize: import('sequelize').Sequelize}} deps
   */
  constructor({ sequelize }) {
    this.sequelize = sequelize
  }

  async _withStatementTimeout(ms, fn) {
    return this.sequelize.transaction(async (t) => {
      await this.sequelize.query(`SET LOCAL statement_timeout = ${Number(ms) | 0};`, { transaction: t })
      return fn(t)
    })
  }

  /**
   * Current weather for current local hour (Asia/Ho_Chi_Minh).
   * Returns averaged values over all nodes for the hour window.
   */
  async getCurrentWeather() {
    const tz = 'Asia/Ho_Chi_Minh'
    const sql = `
      WITH bounds AS (
        SELECT
          (date_trunc('hour', now() AT TIME ZONE :tz) AT TIME ZONE :tz) AS start_ts,
          ((date_trunc('hour', now() AT TIME ZONE :tz) + interval '1 hour') AT TIME ZONE :tz) AS end_ts
      )
      SELECT
        COALESCE(AVG(temp), 0)::float AS temperature,
        COALESCE(AVG(rhum), 0)::float AS humidity,
        COALESCE(AVG(wspd), 0)::float AS wind_speed
      FROM weather_measurements wm
      CROSS JOIN bounds b
      WHERE wm.time >= b.start_ts AND wm.time < b.end_ts;
    `

    return this._withStatementTimeout(5000, (t) =>
      this.sequelize.query(sql, {
        type: QueryTypes.SELECT,
        replacements: { tz },
        transaction: t,
      }).then((rows) => rows[0] || null),
    )
  }

  /**
   * 24h hourly rain forecast (last 24 hours), bucketed by local hour.
   * Frontend expects local "HH:mm".
   */
  async getRainForecast24h() {
    const tz = 'Asia/Ho_Chi_Minh'
    const sql = `
      SELECT
        to_char(bucket_local, 'HH24:MI') AS time,
        COALESCE(AVG(prcp), 0)::float AS value
      FROM (
        SELECT
          time_bucket('1 hour', (wm.time AT TIME ZONE :tz)) AS bucket_local,
          wm.prcp
        FROM weather_measurements wm
        WHERE wm.time >= now() - interval '24 hours'
      ) x
      GROUP BY bucket_local
      ORDER BY bucket_local ASC
      LIMIT 24;
    `

    return this._withStatementTimeout(7000, (t) =>
      this.sequelize.query(sql, {
        type: QueryTypes.SELECT,
        replacements: { tz },
        transaction: t,
      }),
    )
  }

  /**
   * Flood risk counts for CURRENT local hour only.
   * Groups by risk_level.
   */
  async getCurrentFloodRiskCounts() {
    const tz = 'Asia/Ho_Chi_Minh'
    const sql = `
      WITH bounds AS (
        SELECT
          (date_trunc('hour', now() AT TIME ZONE :tz) AT TIME ZONE :tz) AS start_ts,
          ((date_trunc('hour', now() AT TIME ZONE :tz) + interval '1 hour') AT TIME ZONE :tz) AS end_ts
      )
      SELECT fp.risk_level, COUNT(*)::int AS count
      FROM flood_predictions fp
      CROSS JOIN bounds b
      WHERE fp.time >= b.start_ts AND fp.time < b.end_ts
      GROUP BY fp.risk_level;
    `

    return this._withStatementTimeout(7000, (t) =>
      this.sequelize.query(sql, {
        type: QueryTypes.SELECT,
        replacements: { tz },
        transaction: t,
      }),
    )
  }

  /**
   * Recent actual flood reports -> alerts.
   */
  async getRecentAlerts(limit = 10) {
    const sql = `
      SELECT
        afr.report_id,
        afr.created_at,
        afr.latitude,
        afr.longitude,
        afr.reported_level
      FROM actual_flood_reports afr
      ORDER BY afr.created_at DESC
      LIMIT :limit;
    `
    return this._withStatementTimeout(5000, (t) =>
      this.sequelize.query(sql, {
        type: QueryTypes.SELECT,
        replacements: { limit: Number(limit) | 0 },
        transaction: t,
      }),
    )
  }
}

module.exports = { DashboardRepository }

