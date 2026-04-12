require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const app = require('./app');

const PORT = process.env.PORT || 4000;
// trust proxy is now set in app.js before middlewares — do NOT set it here again
app.listen(PORT, () => {
  console.log(`✦ Hriatrengna API running on port ${PORT}`);
  console.log(`  Environment: ${process.env.NODE_ENV}`);
});
// NOTE: All cron jobs are started inside app.js via startCronJobs() from cron.service.js.
// DO NOT add additional cron schedules here — they would run in parallel and send duplicate emails.
