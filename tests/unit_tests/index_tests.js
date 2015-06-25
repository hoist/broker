'use strict';
import index from '../../lib';
import Receiver from '../../lib/receiver';
//import Publisher from '../../lib/publisher';
import {
  expect
}
from 'chai';

describe('index', () => {

  it('exposes the Publisher', () => {
    return expect(index.Receiver).to.eql(Receiver);
  });
  it('exposes the Receiver', () => {
    return expect(index.Publisher).to.eql(true);
  });
});
