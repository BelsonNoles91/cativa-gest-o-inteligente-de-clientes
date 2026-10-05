const requiredMajor = 22;
const [major] = process.versions.node.split(".").map(Number);

if (!Number.isFinite(major) || major < requiredMajor) {
  throw new Error(
    `Node.js ${requiredMajor}+ é obrigatório para este projeto; versão atual: ${process.versions.node}.`,
  );
}

console.log(`Node.js ${process.versions.node} compatível.`);
