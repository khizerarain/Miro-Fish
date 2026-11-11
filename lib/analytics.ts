/** Product analytics as structured logs. No third-party pixel. */
export function track(name: string, props: Record<string, string | number | boolean | null | undefined> = {}) {
  const row = { evt: "ui", name, t: Date.now(), ...props };
  console.log(JSON.stringify(row));
}
