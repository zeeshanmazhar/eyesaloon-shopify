export async function action({ request }) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || typeof file === "string") {
    return Response.json({ error: "Missing prescription file" }, { status: 400 });
  }

  return Response.json(
    {
      error: "Rx upload storage is not configured yet",
      filename: file.name,
      size: file.size,
    },
    { status: 501 },
  );
}

export async function loader() {
  return Response.json({ error: "Method not allowed" }, { status: 405 });
}
