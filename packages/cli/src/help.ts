export function printHelp(): void {
  const out = `
knowledge-test — build and serve static knowledge test sites from a JSON bank

Usage:
  knowledge-test <command> [options]

Commands:
  dev           Start the Astro dev server against a content directory
  build         Build the static site (dist/) with a Pagefind index
  preview       Preview the built dist/
  validate      Validate a knowledge bank without building
  doctor        Diagnose a content directory (layout, counts, deploy readiness)
  init          Scaffold a new lightweight content-only repository
  inspect       Inspect an existing bank and suggest migration steps
  deploy-init   Add knowledge-test.config.json + Pages workflow to a bank

Global options:
  --content <path>    Content repository to load (default: ./examples/demo-bank)
  --help, -h          Show this help
  --version, -v       Show the CLI version

Examples:
  knowledge-test dev --content ../rl-question-base
  knowledge-test build --content .
  knowledge-test validate --content ../ml-compiler-knowledge-test
  knowledge-test init my-bank
  knowledge-test deploy-init --content ../rl-question-base --dry-run
`;
  console.log(out.trimStart());
}

export function printVersion(): void {
  console.log('knowledge-test v0.1.0');
}
