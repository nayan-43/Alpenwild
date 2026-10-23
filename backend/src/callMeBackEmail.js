function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

export function buildCallMeBackEmailHtml({
  name,
  email,
  phone_number,
  best_time,
  question_comments,
}) {
  const rows = [
    ["First Name", name],
    ["Email", email],
    ["Phone Number", phone_number],
    ["Best Time to Call", best_time],
    ["Questions or Comments", question_comments],
  ]
    .map(
      ([label, value]) => `<tr>
				<td width='37%' align='left' valign='top'>${label}</td>
				<td width='2%' align='left' valign='top'><strong>:</strong></td>
				<td width='61%' align='left' valign='top'>${escapeHtml(value)}</td>
				</tr>`,
    )
    .join("");

  return `<html><body>
<table border='0' cellpadding='6' width='600' align='center'>
<tr>
<td colspan=2 align='left'><p align='justify' style='line-height:140%'><table width='100%' border='0' cellspacing='0' cellpadding='0'>
<tr>
<td align='left' valign='top'>
<table width='100%' border='0' cellspacing='2' cellpadding='1'>
<tr>
<td height='24' colspan='3' align='left' valign='top'><h3>Call Me Back</h3></td>
</tr>
${rows}
</table></td>
</tr>
</table>
</td>
</tr>
</table>
</body></html>`;
}
