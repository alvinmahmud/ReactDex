const ts = require("typescript");

module.exports = {
  name: "jest-vite-env",
  version: 1,
  factory: () => (context) => {
    const visit = (node) => {
      // Vite replaces this expression during builds; Jest runs outside Vite.
      if (
        ts.isPropertyAccessExpression(node) &&
        node.name.text === "BASE_URL" &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === "env" &&
        ts.isMetaProperty(node.expression.expression) &&
        node.expression.expression.keywordToken === ts.SyntaxKind.ImportKeyword
      ) {
        return ts.factory.createStringLiteral("/ReactDex/");
      }
      return ts.visitEachChild(node, visit, context);
    };
    return (sourceFile) => ts.visitNode(sourceFile, visit);
  },
};
