const fileStream = require("fs");
const util = require("util");
const exec = util.promisify(require("child_process").exec);

async function command(cmd) {
  try {
    const { stdout, stderr } = await exec(cmd);
    if (stderr) {
      throw stderr;
    }
    return stdout.trim();
  } catch (error) {
    throw Error(error);
  }
}

async function readFile(path) {
  return new Promise((resolve, reject) => {
    fileStream.readFile(path, "utf-8", (err, data) => {
      if (err) {
        reject(err);
      }
      resolve(data);
    });
  });
}
async function prepareTestSets(jsonFilePath) {
  const contents = await readFile(jsonFilePath);
  const sets = JSON.parse(contents);
  let tracedPaths = " ";
  const preparedSets = [];
  // Defined Paths
  for (const set of sets) {
    const { name, basePath, modules } = set;
    if (!modules.length) {
      console.warn(`${name} doesn't have modules defined`);
    } else {
      for (const module of modules) {
        const pattern = `${basePath}.*${module}`;

        tracedPaths = `${tracedPaths} ${pattern}`;
        const moduleTests = JSON.parse(
          (await command(
            `npx jest --listTests --json --testPathPattern ${pattern}`
          )) || []
        );

        if (moduleTests.length) {
          preparedSets.push({
            name: `${name} / ${module} (${moduleTests.length})`,
            tests: moduleTests,
          });
        } else {
          console.warn(`${name} / ${module} doesn't have tests`);
        }
      }
    }
  }

  // Misc
  const otherTests = JSON.parse(
    (await command(
      `npx jest --listTests --json --testPathIgnorePatterns ${tracedPaths}`
    )) || []
  );
  if (otherTests.length) {
    preparedSets.push({
      name: `Misc (${otherTests.length})`,
      tests: otherTests,
    });
  }

  return preparedSets;
}
prepareTestSets("sets.json").then((data) => {
  fileStream.writeFile("prepareTestSets.json", JSON.stringify(data), () => {});
});
