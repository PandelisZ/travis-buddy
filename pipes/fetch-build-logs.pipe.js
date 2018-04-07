const request = require('request-promise-native');
const logger = require('../utils/logger');
const stripAnsi = require('strip-ansi');

const requestLog = async jobId => {
  const options = {
    uri: `https://api.travis-ci.org/jobs/${jobId}/log.txt?deansi=true`,
    method: 'GET',
    resolveWithFullResponse: true,
  };

  const res = await request(options);
  const log = res.body;

  return log;
};

const validateLog = log => {
  const lastLine = log
    .trim()
    .split(/\r?\n/)
    .pop();

  return lastLine.startsWith('Done.');
};

const fetchBuildsLogs = async context => {
  await Promise.all(
    context.jobs.map(async job => {
      let attempts = 0;

      while (!job.log) {
        const log = await requestLog(job.id);
        const isValid = validateLog(log);

        if (isValid || attempts >= context.meta.maxAttemptsToGetDone) {
          if (isValid) {
            logger.log(
              `Done found after ${attempts}/${
                context.meta.maxAttemptsToGetDone
              } attempts.`,
              context,
            );
          } else {
            logger.log('Max attempts achived, giving up done');
          }

          const cleanLog = stripAnsi(log);
          job.log = cleanLog;
        } else {
          logger.log(
            `Done not found, requesting new log... (${attempts}/${
              context.meta.maxAttemptsToGetDone
            }`,
            context,
          );

          attempts += 1;
          await (ms => new Promise(resolve => setTimeout(resolve, ms)))(1000);
        }
      }
    }),
  );

  return context;
};

module.exports = fetchBuildsLogs;