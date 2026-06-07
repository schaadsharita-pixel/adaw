using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Text;
using System.Drawing.Drawing2D;
using System.IO;
using System.Web.Script.Serialization;

public class TLine {
  public string text;
  public double x;
  public double y;
  public int size;
  public string align;
  public string color;
  public bool bold;
  public bool shadow;
}

class Renderer {
  static int Main(string[] args) {
    string bgPath = "", outputPath = "", jsonFile = "";
    for (int i = 0; i < args.Length; i++) {
      if (args[i] == "-bg") bgPath = args[++i];
      if (args[i] == "-out") outputPath = args[++i];
      if (args[i] == "-json") jsonFile = args[++i];
    }
    if (bgPath == "" || outputPath == "" || jsonFile == "") {
      Console.Error.WriteLine("Usage: -bg <bgPath> -out <outputPath> -json <jsonFile>");
      return 1;
    }
    try {
      string jsonText = File.ReadAllText(jsonFile);
      JavaScriptSerializer jss = new JavaScriptSerializer();
      List<TLine> lines = jss.Deserialize<List<TLine>>(jsonText);
      if (lines == null) { Console.Error.WriteLine("No lines"); return 1; }

      Image bg = Image.FromFile(bgPath);
      Bitmap bmp = new Bitmap(bg.Width, bg.Height);
      Graphics g = Graphics.FromImage(bmp);
      g.SmoothingMode = SmoothingMode.HighQuality;
      g.TextRenderingHint = TextRenderingHint.AntiAliasGridFit;
      g.InterpolationMode = InterpolationMode.HighQualityBicubic;
      g.CompositingQuality = CompositingQuality.HighQuality;
      g.DrawImage(bg, 0, 0, bg.Width, bg.Height);

      // 楷体优先，然后其他中文字体
      string[] fontNames = { "KaiTi", "STKaiti", "Kai", "SimKai", "Microsoft YaHei", "SimHei", "DengXian", "Arial" };

      foreach (TLine ln in lines) {
        if (string.IsNullOrEmpty(ln.text)) continue;
        int px = (int)(bg.Width * ln.x / 100);
        int py = (int)(bg.Height * ln.y / 100);

        // 用户说的bold=true则用Bold，否则也默认加粗（楷体加粗好看）
        FontStyle fstyle = FontStyle.Bold;
        if (!ln.bold) fstyle = FontStyle.Regular;

        Font font = null;
        foreach (string fn in fontNames) {
          try { font = new Font(fn, ln.size, fstyle, GraphicsUnit.Pixel); break; }
          catch { }
        }
        if (font == null) font = new Font("Arial", ln.size, fstyle, GraphicsUnit.Pixel);

        // 默认黑色
        string colorStr = string.IsNullOrEmpty(ln.color) ? "#000000" : ln.color;
        int cr = 0, cg = 0, cb = 0;
        try {
          cr = int.Parse(colorStr.Substring(1, 2), System.Globalization.NumberStyles.HexNumber);
          cg = int.Parse(colorStr.Substring(3, 2), System.Globalization.NumberStyles.HexNumber);
          cb = int.Parse(colorStr.Substring(5, 2), System.Globalization.NumberStyles.HexNumber);
        } catch { }

        string align = string.IsNullOrEmpty(ln.align) ? "left" : ln.align.ToLower();
        if (align == "center" || align == "right") {
          SizeF sf = g.MeasureString(ln.text, font);
          if (align == "center") px = Math.Max(0, (int)((bg.Width - sf.Width) / 2));
          else px = Math.Max(0, (int)(bg.Width - sf.Width - px));
        }

        // 黑色阴影用极浅灰色即可
        if (ln.shadow) {
          using (SolidBrush sb = new SolidBrush(Color.FromArgb(30, 0, 0, 0)))
            g.DrawString(ln.text, font, sb, px + 1f, py + 1f);
        }

        using (SolidBrush brush = new SolidBrush(Color.FromArgb(cr, cg, cb)))
          g.DrawString(ln.text, font, brush, px, py);

        font.Dispose();
      }

      bmp.Save(outputPath, System.Drawing.Imaging.ImageFormat.Png);
      g.Dispose(); bmp.Dispose(); bg.Dispose();
      Console.WriteLine("OK");
      return 0;
    } catch (Exception ex) {
      Console.Error.WriteLine("Error: " + ex.ToString());
      return 1;
    }
  }
}
