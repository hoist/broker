'use strict';
import AWS from 'aws-sdk';
import Bluebird from 'bluebird';
AWS.config.update({
  accessKeyId: 'AKIAJIY5LVANCYKIFSNA',
  secretAccessKey: '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',
  region: 'us-west-2'
});

let s3 = Bluebird.promisifyAll(new AWS.S3());

s3.headBucketAsync({
    Bucket: 'event-payload'
  })
  .then((result) => {
    console.log('result');
  })
  .catch((err) => {
    console.log(err.message, err.stack);
  });
