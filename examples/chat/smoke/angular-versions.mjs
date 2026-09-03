export const ANGULAR_PEER_RANGE = '^20.0.0 || ^21.0.0 || ^22.0.0';
export const SUPPORTED_ANGULAR_MAJORS = Object.freeze([20, 21, 22]);

function lane(major, framework, cli, cdk, typescript) {
  return Object.freeze({
    major,
    node: '22.22.3',
    dependencies: Object.freeze({
      '@angular/common': framework,
      '@angular/compiler': framework,
      '@angular/core': framework,
      '@angular/forms': framework,
      '@angular/platform-browser': framework,
      '@angular/router': framework,
      '@angular/cdk': cdk,
      '@angular/google-maps': cdk,
    }),
    devDependencies: Object.freeze({
      '@angular/build': cli,
      '@angular/cli': cli,
      '@angular/compiler-cli': framework,
      typescript,
    }),
  });
}

export const ANGULAR_LANES = Object.freeze({
  20: lane(20, '20.3.30', '20.3.35', '20.2.14', '5.9.3'),
  21: lane(21, '21.2.22', '21.2.22', '21.2.14', '5.9.3'),
  22: lane(22, '22.1.4', '22.1.6', '22.1.4', '6.0.3'),
});

export function getAngularLane(value) {
  const major = Number(value);
  const selected = ANGULAR_LANES[major];
  if (!selected) {
    throw new Error(
      `Unsupported Angular major ${value}. Expected one of: ${SUPPORTED_ANGULAR_MAJORS.join(
        ', '
      )}`
    );
  }
  return selected;
}
