/**
 * Abstract Visual Provider Interface (OCP 준수)
 */
class VisualProvider {
  async record(scene, outputPath) {
    throw new Error('record(scene, outputPath) must be implemented');
  }
}

module.exports = VisualProvider;
