import {runApiTests} from './api-tests.mjs';
const origin=process.env.SPLIT_TEST_ORIGIN||'http://127.0.0.1:4173';
if(!['127.0.0.1','localhost','terminal.local'].includes(new URL(origin).hostname))throw new Error('Use a local test environment.');
console.log('Isolated test book:',await runApiTests(origin));
