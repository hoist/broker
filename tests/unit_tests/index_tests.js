'use strict';
import * as index from '../../src';
import {
  Receiver
}
from '../../src/receiver';
import {
  Publisher
}
from '../../src/publisher';
import {
  expect
}
from 'chai';

describe('index', () => {
  it('exposes the Publisher', () => {
    return expect(index.Receiver).to.eql(Receiver);
  });
  it('exposes the Receiver', () => {
    return expect(index.Publisher).to.eql(Publisher);
  });
});
