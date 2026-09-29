export class RenderCancelled extends Error {
  constructor() {
    super('Render cancelled');
  }
}
