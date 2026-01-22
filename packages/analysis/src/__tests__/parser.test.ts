/**
 * @package @forge/analysis
 * @description Tests for source code parser
 */

import { describe, it, expect } from 'vitest';
import { parseSourceCode, calculateFunctionComplexity, ParsedFunction } from '../parser.js';

describe('parser', () => {
  describe('parseSourceCode - TypeScript', () => {
    it('should parse function declarations', () => {
      const code = `
function greet(name: string): string {
  return "Hello, " + name;
}

async function fetchData(url: string): Promise<string> {
  return await fetch(url).then(r => r.text());
}
      `;

      const result = parseSourceCode(code, 'typescript');

      expect(result.functions.length).toBe(2);
      expect(result.functions[0]?.name).toBe('greet');
      expect(result.functions[0]?.params).toContain('name: string');
      expect(result.functions[1]?.name).toBe('fetchData');
    });

    it('should parse arrow functions', () => {
      const code = `
const add = (a: number, b: number) => {
  return a + b;
};

export const multiply = (a: number, b: number) => a * b;
      `;

      const result = parseSourceCode(code, 'typescript');

      expect(result.functions.length).toBeGreaterThanOrEqual(1);
      expect(result.functions.some(f => f.name === 'add')).toBe(true);
    });

    it('should parse class declarations', () => {
      const code = `
class Calculator {
  add(a: number, b: number): number {
    return a + b;
  }

  subtract(a: number, b: number): number {
    return a - b;
  }
}

export class AdvancedCalculator extends Calculator {
  multiply(a: number, b: number): number {
    return a * b;
  }
}
      `;

      const result = parseSourceCode(code, 'typescript');

      expect(result.classes.length).toBe(2);
      expect(result.classes[0]?.name).toBe('Calculator');
      expect(result.classes[1]?.name).toBe('AdvancedCalculator');
    });

    it('should parse imports', () => {
      const code = `
import { useState, useEffect } from 'react';
import React from 'react';
import * as lodash from 'lodash';
      `;

      const result = parseSourceCode(code, 'typescript');

      expect(result.imports.length).toBe(3);
      expect(result.imports[0]?.specifiers).toContain('useState');
      expect(result.imports[0]?.specifiers).toContain('useEffect');
      expect(result.imports[0]?.source).toBe('react');
      expect(result.imports[1]?.isDefault).toBe(true);
      expect(result.imports[2]?.isNamespace).toBe(true);
    });

    it('should parse exports', () => {
      const code = `
export function helper() {}
export const VALUE = 42;
export default class Main {}
export type User = { name: string };
export interface Config { key: string; }
      `;

      const result = parseSourceCode(code, 'typescript');

      expect(result.exports.length).toBeGreaterThanOrEqual(3);
    });

    it('should parse comments', () => {
      const code = `
// Single line comment
const x = 1;

/* Block comment */
const y = 2;

/**
 * JSDoc comment
 * @param name - The name
 */
function greet(name: string) {}
      `;

      const result = parseSourceCode(code, 'typescript');

      expect(result.comments.length).toBeGreaterThanOrEqual(2);
      expect(result.comments.some(c => c.text.includes('Single line'))).toBe(true);
      expect(result.comments.some(c => c.isBlock)).toBe(true);
    });

    it('should detect documentation on functions', () => {
      const code = `
/**
 * Greets a person
 */
function greet(name: string) {
  return "Hello, " + name;
}

function undocumented(x: number) {
  return x * 2;
}
      `;

      const result = parseSourceCode(code, 'typescript');

      const greet = result.functions.find(f => f.name === 'greet');
      const undocumented = result.functions.find(f => f.name === 'undocumented');

      expect(greet?.hasDocumentation).toBe(true);
      expect(undocumented?.hasDocumentation).toBe(false);
    });

    it('should detect type annotations', () => {
      const code = `
function typed(x: number): number {
  return x * 2;
}

function untyped(x) {
  return x * 2;
}
      `;

      const result = parseSourceCode(code, 'typescript');

      const typed = result.functions.find(f => f.name === 'typed');
      const untyped = result.functions.find(f => f.name === 'untyped');

      expect(typed?.hasTypeAnnotations).toBe(true);
      expect(untyped?.hasTypeAnnotations).toBe(false);
    });
  });

  describe('parseSourceCode - JavaScript', () => {
    it('should parse JavaScript functions', () => {
      const code = `
function greet(name) {
  return "Hello, " + name;
}

const add = (a, b) => a + b;
      `;

      const result = parseSourceCode(code, 'javascript');

      expect(result.functions.length).toBeGreaterThanOrEqual(1);
      expect(result.functions[0]?.name).toBe('greet');
    });

    it('should parse JavaScript classes', () => {
      const code = `
class Animal {
  constructor(name) {
    this.name = name;
  }

  speak() {
    console.log(this.name + ' makes a sound.');
  }
}

class Dog extends Animal {
  speak() {
    console.log(this.name + ' barks.');
  }
}
      `;

      const result = parseSourceCode(code, 'javascript');

      expect(result.classes.length).toBe(2);
      expect(result.classes[0]?.name).toBe('Animal');
      expect(result.classes[1]?.name).toBe('Dog');
    });
  });

  describe('parseSourceCode - Python', () => {
    it('should parse Python functions', () => {
      const code = `
def greet(name):
    return f"Hello, {name}"

async def fetch_data(url):
    return await http.get(url)
      `;

      const result = parseSourceCode(code, 'python');

      expect(result.functions.length).toBe(2);
      expect(result.functions[0]?.name).toBe('greet');
      expect(result.functions[1]?.name).toBe('fetch_data');
    });

    it('should parse Python classes', () => {
      const code = `
class Calculator:
    def add(self, a, b):
        return a + b

class AdvancedCalculator(Calculator):
    def multiply(self, a, b):
        return a * b
      `;

      const result = parseSourceCode(code, 'python');

      expect(result.classes.length).toBe(2);
      expect(result.classes[0]?.name).toBe('Calculator');
      expect(result.classes[1]?.name).toBe('AdvancedCalculator');
    });

    it('should parse Python imports', () => {
      const code = `
import os
from typing import Dict, List
from collections import defaultdict
      `;

      const result = parseSourceCode(code, 'python');

      expect(result.imports.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('parseSourceCode - Java', () => {
    it('should parse Java methods', () => {
      const code = `
public class Calculator {
    public int add(int a, int b) {
        return a + b;
    }

    private static void helper() {
        System.out.println("Helper");
    }
}
      `;

      const result = parseSourceCode(code, 'java');

      expect(result.functions.length).toBeGreaterThanOrEqual(1);
      expect(result.classes.length).toBe(1);
      expect(result.classes[0]?.name).toBe('Calculator');
    });

    it('should parse Java imports', () => {
      const code = `
import java.util.List;
import java.util.ArrayList;
import static java.lang.Math.*;
      `;

      const result = parseSourceCode(code, 'java');

      expect(result.imports.length).toBe(3);
    });
  });

  describe('parseSourceCode - Go', () => {
    it('should parse Go functions', () => {
      const code = `
func greet(name string) string {
    return "Hello, " + name
}

func (c *Calculator) Add(a, b int) int {
    return a + b
}
      `;

      const result = parseSourceCode(code, 'go');

      expect(result.functions.length).toBeGreaterThanOrEqual(1);
    });

    it('should parse Go structs', () => {
      const code = `
type User struct {
    Name string
    Age  int
}

type Calculator struct {
    value int
}
      `;

      const result = parseSourceCode(code, 'go');

      expect(result.classes.length).toBe(2);
      expect(result.classes[0]?.name).toBe('User');
      expect(result.classes[1]?.name).toBe('Calculator');
    });
  });

  describe('parseSourceCode - Unknown language', () => {
    it('should fall back to generic parsing', () => {
      const code = `
function doSomething() {
  return 42;
}

class MyClass {
  method() {}
}
      `;

      const result = parseSourceCode(code, 'unknown');

      expect(result.functions.length).toBeGreaterThanOrEqual(0);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('calculateFunctionComplexity', () => {
    it('should calculate basic complexity', () => {
      const func: ParsedFunction = {
        name: 'simple',
        startLine: 1,
        endLine: 5,
        params: ['x'],
        hasTypeAnnotations: true,
        hasDocumentation: false,
        body: `{
          return x * 2;
        }`,
      };

      const result = calculateFunctionComplexity(func, 'test.ts');

      expect(result.name).toBe('simple');
      expect(result.cyclomaticComplexity).toBe(1);
      expect(result.linesOfCode).toBe(5);
      expect(result.parameterCount).toBe(1);
    });

    it('should calculate complexity for conditionals', () => {
      const func: ParsedFunction = {
        name: 'conditional',
        startLine: 1,
        endLine: 10,
        params: ['x', 'y'],
        hasTypeAnnotations: true,
        hasDocumentation: false,
        body: `{
          if (x > 0) {
            return x;
          } else if (x < 0) {
            return -x;
          } else {
            return y;
          }
        }`,
      };

      const result = calculateFunctionComplexity(func, 'test.ts');

      expect(result.cyclomaticComplexity).toBeGreaterThanOrEqual(2);
    });

    it('should calculate complexity for loops', () => {
      const func: ParsedFunction = {
        name: 'looped',
        startLine: 1,
        endLine: 10,
        params: ['arr'],
        hasTypeAnnotations: false,
        hasDocumentation: false,
        body: `{
          for (let i = 0; i < arr.length; i++) {
            while (condition) {
              doSomething();
            }
          }
        }`,
      };

      const result = calculateFunctionComplexity(func, 'test.ts');

      expect(result.cyclomaticComplexity).toBeGreaterThanOrEqual(3);
    });

    it('should calculate nesting depth', () => {
      const func: ParsedFunction = {
        name: 'nested',
        startLine: 1,
        endLine: 15,
        params: [],
        hasTypeAnnotations: false,
        hasDocumentation: false,
        body: `{
          if (a) {
            if (b) {
              if (c) {
                if (d) {
                  return true;
                }
              }
            }
          }
        }`,
      };

      const result = calculateFunctionComplexity(func, 'test.ts');

      expect(result.nestingDepth).toBeGreaterThanOrEqual(4);
    });

    it('should count logical operators', () => {
      const func: ParsedFunction = {
        name: 'logical',
        startLine: 1,
        endLine: 5,
        params: ['a', 'b', 'c'],
        hasTypeAnnotations: false,
        hasDocumentation: false,
        body: `{
          if (a && b || c && d) {
            return true;
          }
        }`,
      };

      const result = calculateFunctionComplexity(func, 'test.ts');

      expect(result.cyclomaticComplexity).toBeGreaterThanOrEqual(3);
    });

    it('should handle ternary operators', () => {
      const func: ParsedFunction = {
        name: 'ternary',
        startLine: 1,
        endLine: 3,
        params: ['x'],
        hasTypeAnnotations: true,
        hasDocumentation: false,
        body: `{
          return x > 0 ? 'positive' : 'non-positive';
        }`,
      };

      const result = calculateFunctionComplexity(func, 'test.ts');

      expect(result.cyclomaticComplexity).toBeGreaterThanOrEqual(2);
    });

    it('should handle nullish coalescing', () => {
      const func: ParsedFunction = {
        name: 'nullish',
        startLine: 1,
        endLine: 3,
        params: ['x'],
        hasTypeAnnotations: true,
        hasDocumentation: false,
        body: `{
          return x ?? defaultValue;
        }`,
      };

      const result = calculateFunctionComplexity(func, 'test.ts');

      expect(result.cyclomaticComplexity).toBeGreaterThanOrEqual(1);
    });
  });
});
