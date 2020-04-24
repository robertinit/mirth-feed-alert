const env = require("dotenv").config({ path: "C:\\NODE\\feed alert\\.env" }),
  { Pool } = require("pg"),
  nodemailer = require("nodemailer"),
  fs = require("fs"),
  pool = new Pool({
    user: env.parsed.DB_USER,
    host: env.parsed.DB_HOST,
    database: env.parsed.DB_TABLE,
    password: env.parsed.DB_PASSWORD,
    port: env.parsed.DB_PORT
  }),
  alreadyProcessed = [],
  init = channel => {
    pool.query(
      `select * from d_mm${channel.table} where status in ('Q', 'E') and received_date > now() - interval '24 hour' order by received_date limit 1;`,
      (err, res) => {
        if (err) {
          fs.appendFile("alert.log", ` ${err} ${Date()}\r\n`, error => {
            if (error) throw error;
          });
          return err;
        }
        if (res.rows.length > 0) {
          const result = res.rows[0];
          let alert = `d_mm${channel.table}:ID ${result.message_id}`;
          const date = Date.now();
          let currentHour = new Date().getHours();
          console.log(currentHour);
          const age = Math.floor((date - result.received_date) / 60000);
          if (
            age >= 5 &&
            alreadyProcessed.indexOf(alert) < 0 &&
            currentHour >= 3
          ) {
            main(age, channel);
            alreadyProcessed.push(alert);
            fs.appendFile("alert.log", `${alert} ${Date()}\r\n`, err => {
              if (err) throw err;
            });
          }
        }
      }
    );
  },
  main = async (age, channel) => {
    let transporter = nodemailer.createTransport({
      host: env.parsed.MAIL_HOST,
      port: env.parsed.MAIL_PORT,
      secure: false,
      auth: {
        user: env.parsed.MAIL_USER,
        pass: env.parsed.MAIL_PASSWORD
      },
      tls: {
        rejectUnauthorized: false
      }
    });
    await transporter.sendMail({
      from: env.parsed.MAIL_SENDER,
      to: env.parsed.MAIL_DEST,
      subject: `${channel.name} needs attention.`,
      text: `${channel.name} has a message that has been in an undesired state for ${age} minutes.`
    });
  },
  beginAlerts = () => {
    pool.query(
      `select c.name, d.local_channel_id from channel c inner join d_channels d on c.id = d.channel_id order by c.name;`,
      (err, res) => {
        if (err) {
          fs.appendFile("alert.log", ` ${err} ${Date()}\r\n`, error => {
            if (error) throw error;
          });
          return err;
        }
        if (res.rows.length > 0) {
          res.rows.forEach(row => {
            init({
              table: row.local_channel_id,
              name: row.name
            });
          });
        }
      }
    );
  };
setInterval(() => {
  beginAlerts();
}, 300000);
beginAlerts();
