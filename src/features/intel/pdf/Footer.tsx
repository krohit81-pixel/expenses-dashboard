import { Text, View } from "@react-pdf/renderer";
import { styles } from "./theme";

/** Running footer on every page after the cover — page number + a confidentiality mark, matching a real consulting deck's convention. */
export function Footer() {
  return (
    <View style={styles.footer} fixed>
      <Text>Atlas — Confidential, prepared for household use only</Text>
      <Text
        render={({ pageNumber, totalPages }) =>
          `Page ${pageNumber} of ${totalPages}`
        }
      />
    </View>
  );
}
