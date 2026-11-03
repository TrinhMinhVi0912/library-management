const cron = require('node-cron');
const config = require('../config');

const jobs = {
  expirePickup: require('./expirePickup.job'),
  markOverdue: require('./markOverdue.job'),
  dueReminder: require('./dueReminder.job'),
  cleanup: require('./cleanup.job'),
  expireReservation: require('./expireReservation.job'),
};
const schedules = {
  expirePickup: '0 * * * *',
  markOverdue: '5 0 * * *',
  dueReminder: '0 8 * * *',
  cleanup: '0 3 * * 0',
  expireReservation: '0 * * * *',
};
let tasks = [];

async function runJob(name) {
  const job = jobs[name];
  if (!job) return null;
  return job.run();
}

function startJobs() {
  if (config.jobs.disableInternalCron || tasks.length) return tasks;
  tasks = Object.entries(jobs).map(([name, job]) => cron.schedule(schedules[name], () => {
    job.run().catch((error) => console.error(`[Jobs] ${name} thất bại:`, error));
  }, { timezone: 'Asia/Ho_Chi_Minh' }));
  return tasks;
}

function stopJobs() {
  for (const task of tasks) task.stop();
  tasks = [];
}

module.exports = { jobs, runJob, startJobs, stopJobs };
