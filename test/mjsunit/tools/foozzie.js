// Copyright 2020 the V8 project authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Flags: --allow-natives-syntax
// Files: tools/clusterfuzz/v8_mock.js

// Test foozzie mocks for differential fuzzing.

// Deterministic Math.random.
assertEquals(0.7098480789645691, Math.random());
assertEquals(0.9742682568175951, Math.random());
assertEquals(0.20008059867222983, Math.random());

// Deterministic date.
assertEquals(1477662728698, Date.now());
assertEquals(1477662728701, Date.now());
assertEquals(1477662728705, new Date().getTime());
assertEquals(710, new Date.prototype.constructor().getUTCMilliseconds());

// Deterministic arguments in constructor keep working.
assertEquals(819134640000,
             new Date('December 17, 1995 03:24:00 GMT+1000').getTime());

// Dummy performance methods.
assertEquals(1.2, performance.now());
assertEquals([], performance.measureMemory());

// Worker messages follow a predefined deterministic pattern.
const worker = new Worker(``, {type: 'string'});
assertEquals(0, worker.getMessage());
assertEquals(-1, worker.getMessage());

// NaN patterns in typed arrays are mocked out. Test that we get no
// difference between unoptimized and optimized code.
function testSameOptimized(pattern, create_fun) {
  const expected = new Uint32Array(pattern);
  %PrepareFunctionForOptimization(create_fun);
  assertEquals(expected, create_fun());
  %OptimizeFunctionOnNextCall(create_fun);
  assertEquals(expected, create_fun());
}

function testArrayType(arrayType, pattern) {
  // Test passing NaNs to constructor with array.
  let create = function() {
    return new Uint32Array(new arrayType([-NaN]).buffer);
  };
  testSameOptimized(pattern, create);
  // Test passing NaNs to constructor with iterator.
  create = function() {
    const iter = function*(){ yield* [-NaN]; }();
    return new Uint32Array(new arrayType(iter).buffer);
  };
  testSameOptimized(pattern, create);
  // Test setting NaN property.
  create = function() {
    const arr = new arrayType(1);
    arr[0] = -NaN;
    return new Uint32Array(arr.buffer);
  };
  testSameOptimized(pattern, create);
  // Test passing NaN using set.
  create = function() {
    const arr = new arrayType(1);
    arr.set([-NaN], 0);
    return new Uint32Array(arr.buffer);
  };
  testSameOptimized(pattern, create);
}

var isBigEndian = new Uint8Array(new Uint16Array([0xABCD]).buffer)[0] === 0xAB;
testArrayType(Float32Array, [1065353216]);
if (isBigEndian){
  testArrayType(Float64Array, [1072693248, 0]);
}
else {
  testArrayType(Float64Array, [0, 1072693248]);
}

// Test that DataView has the same NaN patterns with optimized and
// unoptimized code.
testSameOptimized([4213246272,405619796,61503,0,3675212096,32831], () => {
  const array = new Uint32Array(6);
  const view = new DataView(array.buffer);
  view.setFloat64(0, Math.PI);
  view.setFloat64(8, -undefined);
  view.setFloat32(16, Math.fround(Math.PI));
  view.setFloat32(20, -undefined);
  assertEquals(Math.PI, view.getFloat64(0));
  assertEquals(Math.fround(Math.PI), view.getFloat32(16));
  return array;
});

// Realm.eval is just eval.
assertEquals(1477662728716, Realm.eval(Realm.create(), `Date.now()`));

// Test suppressions when Math.pow is optimized.
function callPow(v) {
  return Math.pow(v, -0.5);
}
%PrepareFunctionForOptimization(callPow);
const unoptimized = callPow(6996);
%OptimizeFunctionOnNextCall(callPow);
assertEquals(unoptimized, callPow(6996));
