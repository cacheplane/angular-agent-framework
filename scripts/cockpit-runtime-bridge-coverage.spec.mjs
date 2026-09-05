import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, test } from 'node:test';
import ts from 'typescript';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const REGISTRY_PATH = join(
  REPO_ROOT,
  'libs/cockpit-registry/src/lib/capability-registry.ts',
);

function unwrapExpression(expression) {
  while (
    ts.isAsExpression(expression) ||
    ts.isParenthesizedExpression(expression) ||
    ts.isSatisfiesExpression(expression)
  ) {
    expression = expression.expression;
  }

  return expression;
}

function propertyName(property) {
  const name = property.name;
  return ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : undefined;
}

async function registryAngularProjects() {
  const source = await readFile(REGISTRY_PATH, 'utf8');
  const sourceFile = ts.createSourceFile(
    REGISTRY_PATH,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const declaration = sourceFile.statements
    .filter(ts.isVariableStatement)
    .flatMap((statement) => [...statement.declarationList.declarations])
    .find(
      (candidate) =>
        ts.isIdentifier(candidate.name) && candidate.name.text === 'capabilities',
    );

  assert.ok(declaration?.initializer, 'capability-registry.ts must declare capabilities');
  const initializer = unwrapExpression(declaration.initializer);
  assert.ok(
    ts.isArrayLiteralExpression(initializer),
    'capability-registry.ts capabilities must remain an array literal',
  );

  return initializer.elements.map((element, index) => {
    const entry = unwrapExpression(element);
    assert.ok(
      ts.isObjectLiteralExpression(entry),
      `capability-registry.ts capability ${index + 1} must be an object literal`,
    );
    const angularProject = entry.properties.find(
      (property) => ts.isPropertyAssignment(property) && propertyName(property) === 'angularProject',
    );
    assert.ok(
      angularProject && ts.isPropertyAssignment(angularProject),
      `capability-registry.ts capability ${index + 1} must declare angularProject`,
    );
    const value = unwrapExpression(angularProject.initializer);
    assert.ok(
      ts.isStringLiteral(value),
      `capability-registry.ts capability ${index + 1} angularProject must be a string literal`,
    );

    return value.text;
  });
}

async function findProjectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await findProjectFiles(path)));
    } else if (entry.name === 'project.json') {
      files.push(path);
    }
  }

  return files;
}

async function cockpitProjectRoots() {
  const projectFiles = await findProjectFiles(join(REPO_ROOT, 'cockpit'));
  const roots = new Map();

  for (const projectFile of projectFiles) {
    const project = JSON.parse(await readFile(projectFile, 'utf8'));
    if (typeof project.name === 'string') {
      assert.ok(
        !roots.has(project.name),
        `duplicate Cockpit project name ${project.name} in ${projectFile}`,
      );
      roots.set(project.name, dirname(projectFile));
    }
  }

  return roots;
}

function entryPointProblems(path, source) {
  const sourceFile = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  let importsHarness = false;
  let usesHarness = false;
  let importsAngularBootstrap = false;
  let callsAngularBootstrap = false;
  const harnessBindings = new Set();
  const angularBootstrapBindings = new Set();
  const angularNamespaceBindings = new Set();

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
      continue;
    }

    const imports = statement.importClause?.namedBindings;
    if (
      statement.moduleSpecifier.text === '@threadplane/cockpit-telemetry' &&
      imports &&
      ts.isNamedImports(imports)
    ) {
      for (const element of imports.elements) {
        const importsHarnessBinding =
          (element.propertyName?.text ?? element.name.text) ===
          'bootstrapWithCockpitHarness';
        importsHarness ||= importsHarnessBinding;
        if (importsHarnessBinding) {
          harnessBindings.add(element.name.text);
        }
      }
    }

    if (statement.moduleSpecifier.text === '@angular/platform-browser' && imports) {
      const importsAngularNamespace = ts.isNamespaceImport(imports);
      importsAngularBootstrap ||= importsAngularNamespace;
      if (importsAngularNamespace) {
        angularNamespaceBindings.add(imports.name.text);
      } else {
        for (const element of imports.elements) {
          const importsBootstrapBinding =
            (element.propertyName?.text ?? element.name.text) ===
            'bootstrapApplication';
          importsAngularBootstrap ||= importsBootstrapBinding;
          if (importsBootstrapBinding) {
            angularBootstrapBindings.add(element.name.text);
          }
        }
      }
    }
  }

  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (ts.isIdentifier(callee)) {
        usesHarness ||= harnessBindings.has(callee.text);
        callsAngularBootstrap ||= angularBootstrapBindings.has(callee.text);
      } else if (
        ts.isPropertyAccessExpression(callee) &&
        ts.isIdentifier(callee.expression)
      ) {
        callsAngularBootstrap ||=
          angularNamespaceBindings.has(callee.expression.text) &&
          callee.name.text === 'bootstrapApplication';
      } else if (
        ts.isElementAccessExpression(callee) &&
        ts.isIdentifier(callee.expression) &&
        ts.isStringLiteral(callee.argumentExpression)
      ) {
        callsAngularBootstrap ||=
          angularNamespaceBindings.has(callee.expression.text) &&
          callee.argumentExpression.text === 'bootstrapApplication';
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  const problems = [];
  if (!importsHarness) {
    problems.push('does not import bootstrapWithCockpitHarness from @threadplane/cockpit-telemetry');
  }
  if (!usesHarness) {
    problems.push('does not call bootstrapWithCockpitHarness');
  }
  if (importsAngularBootstrap) {
    problems.push('imports bootstrapApplication from @angular/platform-browser');
  }
  if (callsAngularBootstrap) {
    problems.push('calls bootstrapApplication directly');
  }

  return problems;
}

describe('entryPointProblems', () => {
  test('accumulates split Angular bootstrap imports', () => {
    const problems = entryPointProblems(
      'src/main.ts',
      `
        import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';
        import { bootstrapApplication as boot } from '@angular/platform-browser';
        import { platformBrowser } from '@angular/platform-browser';
        void bootstrapWithCockpitHarness(AppComponent, appConfig).catch(console.error);
        boot(AppComponent, appConfig);
      `,
    );

    assert.deepEqual(problems, [
      'imports bootstrapApplication from @angular/platform-browser',
      'calls bootstrapApplication directly',
    ]);
  });

  test('accepts an imported harness alias when that binding is called', () => {
    const problems = entryPointProblems(
      'src/main.ts',
      `
        import { bootstrapWithCockpitHarness as bootHarness } from '@threadplane/cockpit-telemetry';
        void bootHarness(AppComponent, appConfig).catch(console.error);
      `,
    );

    assert.deepEqual(problems, []);
  });

  test('rejects an unused harness alias when an unrelated local function is called', () => {
    const problems = entryPointProblems(
      'src/main.ts',
      `
        import { bootstrapWithCockpitHarness as bootHarness } from '@threadplane/cockpit-telemetry';
        function bootstrapWithCockpitHarness() {}
        bootstrapWithCockpitHarness();
      `,
    );

    assert.deepEqual(problems, ['does not call bootstrapWithCockpitHarness']);
  });

  test('rejects namespace imports and property-access Angular bootstrap calls', () => {
    const problems = entryPointProblems(
      'src/main.ts',
      `
        import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';
        import * as browser from '@angular/platform-browser';
        void bootstrapWithCockpitHarness(AppComponent, appConfig).catch(console.error);
        browser.bootstrapApplication(AppComponent, appConfig);
      `,
    );

    assert.deepEqual(problems, [
      'imports bootstrapApplication from @angular/platform-browser',
      'calls bootstrapApplication directly',
    ]);
  });

  test('rejects aliased named Angular bootstrap imports', () => {
    const problems = entryPointProblems(
      'src/main.ts',
      `
        import { bootstrapApplication as boot } from '@angular/platform-browser';
        boot(AppComponent, appConfig);
      `,
    );

    assert.ok(
      problems.includes('imports bootstrapApplication from @angular/platform-browser'),
    );
  });

  test('rejects computed-property Angular bootstrap calls', () => {
    const problems = entryPointProblems(
      'src/main.ts',
      `
        import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';
        import * as browser from '@angular/platform-browser';
        void bootstrapWithCockpitHarness(AppComponent, appConfig).catch(console.error);
        browser['bootstrapApplication'](AppComponent, appConfig);
      `,
    );

    assert.deepEqual(problems, [
      'imports bootstrapApplication from @angular/platform-browser',
      'calls bootstrapApplication directly',
    ]);
  });

  test('accepts a valid readiness-aware harness entry point', () => {
    const problems = entryPointProblems(
      'src/main.ts',
      `
        import { bootstrapWithCockpitHarness } from '@threadplane/cockpit-telemetry';
        void bootstrapWithCockpitHarness(AppComponent, appConfig).catch(console.error);
      `,
    );

    assert.deepEqual(problems, []);
  });
});

describe('Cockpit Angular runtime bridge coverage', () => {
  test('the capability registry contains exactly 41 unique Angular projects', async () => {
    const projects = await registryAngularProjects();

    assert.equal(projects.length, 41, 'expected exactly 41 registry Angular projects');
    assert.equal(
      new Set(projects).size,
      41,
      'expected every registry Angular project to be unique',
    );
  });

  test('every registry Angular entry point uses the readiness-aware harness', async () => {
    const projects = await registryAngularProjects();
    const projectRoots = await cockpitProjectRoots();
    const failures = [];

    for (const project of projects) {
      const projectRoot = projectRoots.get(project);
      if (!projectRoot) {
        failures.push(`${project}: has no matching cockpit/**/project.json`);
        continue;
      }

      for (const entryPoint of ['src/main.ts', 'src/main.cockpit.ts']) {
        const path = join(projectRoot, entryPoint);
        const displayPath = relative(REPO_ROOT, path);
        let source;

        try {
          source = await readFile(path, 'utf8');
        } catch (error) {
          if (error?.code === 'ENOENT') {
            failures.push(`${displayPath}: file does not exist`);
            continue;
          }
          throw error;
        }

        for (const problem of entryPointProblems(path, source)) {
          failures.push(`${displayPath}: ${problem}`);
        }
      }
    }

    assert.equal(
      failures.length,
      0,
      `Cockpit runtime bridge coverage failures:\n${failures
        .map((failure) => `- ${failure}`)
        .join('\n')}`,
    );
  });
});
