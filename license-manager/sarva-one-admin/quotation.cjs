// cat > /home/claude/generate_quotation3.js << 'JSEOF'
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType,
  VerticalAlign, ImageRun, Header
} = require('docx');
const fs = require('fs');

const BRAND_BLUE  = "1A56DB";
const BRAND_DARK  = "1E293B";
const LIGHT_BLUE  = "EFF6FF";
const LIGHT_GRAY  = "F8FAFC";
const GREEN       = "16A34A";
const RED         = "DC2626";
const TEXT_GRAY   = "64748B";
const WHITE       = "FFFFFF";
const DARK_HEADER = "0F172A";

const logoData = fs.readFileSync('sarvaone_logo.png');

const bdr  = { style: BorderStyle.SINGLE, size: 1, color: "DBEAFE" };
const bdrs = { top: bdr, bottom: bdr, left: bdr, right: bdr };
const nb   = { style: BorderStyle.NONE, size: 0, color: WHITE };
const nbs  = { top: nb, bottom: nb, left: nb, right: nb };

function sp(pts = 120) {
  return new Paragraph({ children: [new TextRun("")], spacing: { before: pts, after: 0 } });
}
function divider(color = "DBEAFE") {
  return new Paragraph({
    children: [new TextRun("")],
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color, space: 1 } },
    spacing: { before: 60, after: 60 }
  });
}
function secHead(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 26, color: BRAND_BLUE, font: "Arial" })],
    spacing: { before: 280, after: 140 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BRAND_BLUE, space: 4 } }
  });
}
function makeTable(headers, rows, colWidths, hdrBg = BRAND_BLUE) {
  const hRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => new TableCell({
      borders: bdrs,
      width: { size: colWidths[i], type: WidthType.DXA },
      shading: { fill: hdrBg, type: ShadingType.CLEAR },
      margins: { top: 100, bottom: 100, left: 140, right: 140 },
      verticalAlign: VerticalAlign.CENTER,
      children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 20, color: WHITE, font: "Arial" })] })]
    }))
  });
  const dRows = rows.map((row, ri) => new TableRow({
    children: row.map((cell, ci) => new TableCell({
      borders: bdrs,
      width: { size: colWidths[ci], type: WidthType.DXA },
      shading: { fill: ri % 2 === 0 ? WHITE : LIGHT_GRAY, type: ShadingType.CLEAR },
      margins: { top: 100, bottom: 100, left: 140, right: 140 },
      verticalAlign: VerticalAlign.CENTER,
      children: [new Paragraph({
        children: [new TextRun({ text: String(cell), size: 20, font: "Arial", color: BRAND_DARK })]
      })]
    }))
  }));
  return new Table({
    width: { size: colWidths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [hRow, ...dRows]
  });
}

function tickRow(items, colWidths) {
 return new Table({
    width: {
        size: colWidths.reduce((a, b) => a + b, 0),
        type: WidthType.DXA
    },
    columnWidths: colWidths,
    rows: items.map((item, ri) => new TableRow({
      children: [
        new TableCell({
          borders: nbs,
          width: { size: colWidths[0], type: WidthType.DXA },
          shading: { fill: ri % 2 === 0 ? WHITE : LIGHT_GRAY, type: ShadingType.CLEAR },
          margins: { top: 90, bottom: 90, left: 140, right: 140 },
          children: [new Paragraph({ children: [new TextRun({ text: item.feature, size: 20, font: "Arial", color: BRAND_DARK })] })]
        }),
        new TableCell({
          borders: nbs,
          width: { size: colWidths[1], type: WidthType.DXA },
          shading: { fill: ri % 2 === 0 ? WHITE : LIGHT_GRAY, type: ShadingType.CLEAR },
          margins: { top: 90, bottom: 90, left: 80, right: 80 },
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: item.app, size: 20, font: "Arial", bold: item.app==="✓"||item.app==="✗", color: item.app==="✓"?GREEN:item.app==="✗"?RED:BRAND_DARK })] })]
        }),
        new TableCell({
          borders: nbs,
          width: { size: colWidths[2], type: WidthType.DXA },
          shading: { fill: ri % 2 === 0 ? WHITE : LIGHT_GRAY, type: ShadingType.CLEAR },
          margins: { top: 90, bottom: 90, left: 80, right: 80 },
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: item.web, size: 20, font: "Arial", bold: item.web==="✓"||item.web==="✗", color: item.web==="✓"?GREEN:item.web==="✗"?RED:BRAND_DARK })] })]
        })
      ]
    }))
  });
}

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 22, color: BRAND_DARK } } }
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 720, right: 1080, bottom: 1080, left: 1080 }
      }
    },

    headers: {
      default: new Header({
        children: [
          new Table({
            width: { size: 10080, type: WidthType.DXA },
            columnWidths: [1600, 5080, 3400],
            rows: [new TableRow({
              children: [
                new TableCell({
                  borders: nbs, width: { size: 1600, type: WidthType.DXA },
                  shading: { fill: WHITE, type: ShadingType.CLEAR },
                  margins: { top: 80, bottom: 80, left: 0, right: 120 },
                  verticalAlign: VerticalAlign.CENTER,
                  children: [new Paragraph({ children: [new ImageRun({ data: logoData, type: "png", transformation: { width: 90, height: 60 } })] })]
                }),
                new TableCell({
                  borders: nbs, width: { size: 5080, type: WidthType.DXA },
                  shading: { fill: WHITE, type: ShadingType.CLEAR },
                  margins: { top: 80, bottom: 80, left: 0, right: 200 },
                  verticalAlign: VerticalAlign.CENTER,
                  children: [
                    new Paragraph({ children: [new TextRun({ text: "sarvaOne", bold: true, size: 32, color: BRAND_BLUE, font: "Arial" })] }),
                    new Paragraph({ children: [new TextRun({ text: "Technology & Digital Solutions", size: 18, color: TEXT_GRAY, font: "Arial" })] }),
                    new Paragraph({ children: [new TextRun({ text: "Bengaluru, Karnataka", size: 17, color: TEXT_GRAY, font: "Arial" })] })
                  ]
                }),
                new TableCell({
                  borders: nbs, width: { size: 3400, type: WidthType.DXA },
                  shading: { fill: LIGHT_BLUE, type: ShadingType.CLEAR },
                  margins: { top: 100, bottom: 100, left: 160, right: 160 },
                  verticalAlign: VerticalAlign.CENTER,
                  children: [
                    new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "Sultan Kabadi & S Likith", bold: true, size: 19, color: BRAND_DARK, font: "Arial" })] }),
                    new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "📞 9886718288", size: 18, color: TEXT_GRAY, font: "Arial" })] }),
                    new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "✉  work.sultanbk@gmail.com", size: 18, color: TEXT_GRAY, font: "Arial" })] })
                  ]
                })
              ]
            })]
          }),
          new Paragraph({
            children: [new TextRun("")],
            border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: BRAND_BLUE, space: 1 } },
            spacing: { before: 80, after: 0 }
          })
        ]
      })
    },

    children: [
      sp(200),

      // ── TITLE BANNER ──
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [5760, 3600],
        rows: [new TableRow({
          children: [
            new TableCell({
              borders: nbs, width: { size: 5760, type: WidthType.DXA },
              shading: { fill: DARK_HEADER, type: ShadingType.CLEAR },
              margins: { top: 200, bottom: 200, left: 240, right: 240 },
              children: [
                new Paragraph({ children: [new TextRun({ text: "PROJECT QUOTATION", bold: true, size: 36, color: WHITE, font: "Arial" })] }),
                new Paragraph({ children: [new TextRun({ text: "EdTech Platform — Android App + Website", size: 22, color: "93C5FD", font: "Arial" })] })
              ]
            }),
            new TableCell({
              borders: nbs, width: { size: 3600, type: WidthType.DXA },
              shading: { fill: BRAND_BLUE, type: ShadingType.CLEAR },
              margins: { top: 200, bottom: 200, left: 240, right: 240 },
              verticalAlign: VerticalAlign.CENTER,
              children: [
                new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "QT-2026-001", bold: true, size: 24, color: WHITE, font: "Arial" })] }),
                new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "Date: June 28, 2026", size: 19, color: "BFDBFE", font: "Arial" })] }),
                new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "Valid for 30 Days", size: 19, color: "BFDBFE", font: "Arial" })] })
              ]
            })
          ]
        })]
      }),

      sp(200),

      // ── PARTIES ──
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [4580, 200, 4580],
        rows: [new TableRow({
          children: [
            new TableCell({
              borders: bdrs, width: { size: 4580, type: WidthType.DXA },
              shading: { fill: LIGHT_BLUE, type: ShadingType.CLEAR },
              margins: { top: 160, bottom: 160, left: 200, right: 200 },
              children: [
                new Paragraph({ children: [new TextRun({ text: "PREPARED BY", bold: true, size: 18, color: BRAND_BLUE, font: "Arial" })] }),
                sp(60),
                new Paragraph({ children: [new TextRun({ text: "sarvaOne", bold: true, size: 24, color: BRAND_DARK, font: "Arial" })] }),
                new Paragraph({ children: [new TextRun({ text: "Sultan Kabadi & S Likith", size: 20, color: BRAND_DARK, font: "Arial" })] }),
                new Paragraph({ children: [new TextRun({ text: "Bengaluru, Karnataka", size: 19, color: TEXT_GRAY, font: "Arial" })] }),
                new Paragraph({ children: [new TextRun({ text: "📞 9886718288", size: 19, color: TEXT_GRAY, font: "Arial" })] }),
                new Paragraph({ children: [new TextRun({ text: "✉  work.sultanbk@gmail.com", size: 19, color: TEXT_GRAY, font: "Arial" })] })
              ]
            }),
            new TableCell({ borders: nbs, width:{size:200,type:WidthType.DXA}, shading:{fill:WHITE,type:ShadingType.CLEAR}, children:[new Paragraph({children:[new TextRun("")]})] }),
            new TableCell({
              borders: bdrs, width: { size: 4580, type: WidthType.DXA },
              shading: { fill: LIGHT_GRAY, type: ShadingType.CLEAR },
              margins: { top: 160, bottom: 160, left: 200, right: 200 },
              children: [
                new Paragraph({ children: [new TextRun({ text: "PREPARED FOR", bold: true, size: 18, color: BRAND_BLUE, font: "Arial" })] }),
                sp(60),
                new Paragraph({ children: [new TextRun({ text: "The Alpha Achievers Academy", bold: true, size: 24, color: BRAND_DARK, font: "Arial" })] }),
                new Paragraph({ children: [new TextRun({ text: "Mahantesh N K", size: 20, color: BRAND_DARK, font: "Arial" })] }),
                new Paragraph({ children: [new TextRun({ text: "📞 7996678514", size: 19, color: TEXT_GRAY, font: "Arial" })] })
              ]
            })
          ]
        })]
      }),

      sp(200),
      divider(),
      sp(100),

      // ── OVERVIEW ──
      secHead("Project Overview"),
      new Paragraph({
        children: [new TextRun({
          text: "This quotation covers the complete development of a budget-optimised EdTech platform for The Alpha Achievers Academy — including an Android mobile app and a responsive website. The platform supports up to 200 active students per month and is built using free-tier infrastructure wherever possible to keep ongoing costs as low as possible for the client.",
          size: 22, font: "Arial", color: BRAND_DARK
        })],
        spacing: { after: 100 }
      }),
      new Paragraph({
        children: [new TextRun({
          text: "Infrastructure costs listed in this document are paid directly by the client to third-party providers and are separate from the development fee.",
          size: 20, font: "Arial", color: TEXT_GRAY, italics: true
        })],
        spacing: { after: 160 }
      }),

      divider(),
      sp(100),

      // ── WHAT WE ARE BUILDING ──
      secHead("What We Are Building"),
      sp(60),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [4580, 4780],
        rows: [new TableRow({
          children: [
            new TableCell({
              borders: bdrs, width:{size:4580,type:WidthType.DXA},
              shading:{fill:LIGHT_BLUE,type:ShadingType.CLEAR},
              margins:{top:160,bottom:160,left:200,right:200},
              children:[
                new Paragraph({children:[new TextRun({text:"📱  Android App", bold:true, size:23, color:BRAND_BLUE, font:"Arial"})], spacing:{after:80}}),
                ...[
                  "Student login and profile",
                  "Watch recorded classes (YouTube)",
                  "Join live classes via Jitsi Meet",
                  "View exam results and leaderboard",
                  "Submit and track assignments",
                  "Pay fees via Razorpay",
                  "Push notifications (FCM)"
                ].map(t => new Paragraph({children:[new TextRun({text:`•  ${t}`, size:20, font:"Arial", color:BRAND_DARK})], spacing:{after:40}}))
              ]
            }),
            new TableCell({
              borders: bdrs, width:{size:4780,type:WidthType.DXA},
              shading:{fill:LIGHT_GRAY,type:ShadingType.CLEAR},
              margins:{top:160,bottom:160,left:200,right:200},
              children:[
                new Paragraph({children:[new TextRun({text:"🌐  Website", bold:true, size:23, color:BRAND_BLUE, font:"Arial"})], spacing:{after:80}}),
                ...[
                  "Student login portal (web)",
                  "Watch recorded classes",
                  "Join live classes via Jitsi Meet",
                  "View results and leaderboard",
                  "Submit assignments online",
                  "Pay fees online via Razorpay",
                  "Admin panel — manage everything"
                ].map(t => new Paragraph({children:[new TextRun({text:`•  ${t}`, size:20, font:"Arial", color:BRAND_DARK})], spacing:{after:40}}))
              ]
            })
          ]
        })]
      }),

      sp(200),
      divider(),
      sp(100),

      // ── FULL FEATURE LIST ──
      secHead("Complete Feature Breakdown"),
      sp(60),

      // Feature/App/Web header
      new Table({
        width:{size:9360,type:WidthType.DXA},
        columnWidths:[5160,2100,2100],
        rows:[new TableRow({
          children:[
            new TableCell({borders:bdrs,width:{size:5160,type:WidthType.DXA},shading:{fill:DARK_HEADER,type:ShadingType.CLEAR},margins:{top:110,bottom:110,left:140,right:140},
              children:[new Paragraph({children:[new TextRun({text:"Feature",bold:true,size:21,color:WHITE,font:"Arial"})]})]
            }),
            new TableCell({borders:bdrs,width:{size:2100,type:WidthType.DXA},shading:{fill:BRAND_BLUE,type:ShadingType.CLEAR},margins:{top:110,bottom:110,left:80,right:80},verticalAlign:VerticalAlign.CENTER,
              children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:"Android App",bold:true,size:21,color:WHITE,font:"Arial"})]})]
            }),
            new TableCell({borders:bdrs,width:{size:2100,type:WidthType.DXA},shading:{fill:"1E40AF",type:ShadingType.CLEAR},margins:{top:110,bottom:110,left:80,right:80},verticalAlign:VerticalAlign.CENTER,
              children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:"Website",bold:true,size:21,color:WHITE,font:"Arial"})]})]
            })
          ]
        })]
      }),
      tickRow([
        {feature:"Student Login & Profile",                         app:"✓", web:"✓"},
        {feature:"Recorded Classes (YouTube Unlisted — Free)",      app:"✓", web:"✓"},
        {feature:"Live Classes (Jitsi Meet — Free, No Time Limit)", app:"✓", web:"✓"},
        {feature:"Exam Results — per student view",                 app:"✓", web:"✓"},
        {feature:"Assignment Submission",                           app:"✓", web:"✓"},
        {feature:"Assignment Grading by Teacher",                   app:"✓", web:"✓"},
        {feature:"Leaderboard — ranked by marks & attendance",      app:"✓", web:"✓"},
        {feature:"Subscription Plans (Monthly / Quarterly)",        app:"✓", web:"✓"},
        {feature:"Tuition Fee Collection via Razorpay",             app:"✓", web:"✓"},
        {feature:"Fee Payment History",                             app:"✓", web:"✓"},
        {feature:"Push Notifications (FCM — Free)",                 app:"✓", web:"✗"},
        {feature:"Admin Panel — Students, Content, Fees",           app:"✗", web:"✓"},
        {feature:"Teacher / Admin Login",                           app:"✗", web:"✓"},
        {feature:"Upload Recorded Videos (YouTube link)",           app:"✗", web:"✓"},
        {feature:"Schedule Live Classes",                           app:"✗", web:"✓"},
        {feature:"Upload & Publish Results",                        app:"✗", web:"✓"},
        {feature:"Revenue & Student Analytics",                     app:"✗", web:"✓"},
      ],[5160,2100,2100]),

      sp(200),
      divider(),
      sp(100),

      // ── TECH STACK ──
      secHead("Technology Stack — Cheapest & Best"),
      sp(60),
      makeTable(
        ["Layer", "Technology", "Cost"],
        [
          ["Android App",           "Flutter (one codebase for app + future iOS)",    "Free"],
          ["Website (Frontend)",    "React.js — fast, modern, responsive",            "Free"],
          ["Backend & Database",    "Firebase (Auth, Firestore, Storage)",            "Free tier — sufficient for 200 students"],
          ["Recorded Classes",      "YouTube Unlisted — teacher uploads via YouTube", "Free — unlimited storage & bandwidth"],
          ["Live Classes",          "Jitsi Meet Embed — no account needed",           "Free — no time limit, no per-user cost"],
          ["Push Notifications",    "Firebase Cloud Messaging (FCM)",                 "Free — unlimited"],
          ["Payment Gateway",       "Razorpay",                                       "2% per transaction — no monthly fee"],
          ["Email Notifications",   "Brevo (ex-Sendinblue) — Free tier",             "Free — up to 300 emails/day"],
          ["Hosting (Website)",     "Firebase Hosting / Vercel",                      "Free tier — sufficient"],
          ["App Distribution",      "Google Play Store",                              "₹2,100 one-time"],
          ["Domain",                "Namecheap",                                      "₹800–₹1,200 / year"],
          ["SSL Certificate",       "Let's Encrypt",                                  "Free forever"]
        ],
        [2800, 3760, 2800]
      ),

      sp(200),
      divider(),
      sp(100),

      // ── PRICING ──
      secHead("Project Investment"),
      sp(80),

      new Table({
        width:{size:9360,type:WidthType.DXA},
        columnWidths:[6400,2960],
        rows:[new TableRow({
          children:[
            new TableCell({
              borders:nbs, width:{size:6400,type:WidthType.DXA},
              shading:{fill:LIGHT_BLUE,type:ShadingType.CLEAR},
              margins:{top:200,bottom:200,left:240,right:240},
              children:[
                new Paragraph({children:[new TextRun({text:"💡  Starter Plan — Android App + Website", bold:true, size:30, color:BRAND_BLUE, font:"Arial"})]}),
                new Paragraph({children:[new TextRun({text:"Full platform. All features. Best price.", size:21, color:TEXT_GRAY, font:"Arial"})]}),
                sp(80),
                new Paragraph({children:[new TextRun({text:"Includes:  Android App  +  Responsive Website  +  Admin Panel", size:20, color:BRAND_DARK, font:"Arial"})]}),
                new Paragraph({children:[new TextRun({text:"Timeline:  10–14 Weeks from advance payment", size:20, color:BRAND_DARK, font:"Arial"})]}),
              ]
            }),
            new TableCell({
              borders:nbs, width:{size:2960,type:WidthType.DXA},
              shading:{fill:BRAND_BLUE,type:ShadingType.CLEAR},
              margins:{top:200,bottom:200,left:200,right:200},
              verticalAlign:VerticalAlign.CENTER,
              children:[
                new Paragraph({alignment:AlignmentType.CENTER, children:[new TextRun({text:"Development Fee", size:19, color:"BFDBFE", font:"Arial"})]}),
                new Paragraph({alignment:AlignmentType.CENTER, children:[new TextRun({text:"₹ ___________", bold:true, size:32, color:WHITE, font:"Arial"})]}),
                new Paragraph({alignment:AlignmentType.CENTER, children:[new TextRun({text:"(Fill before meeting)", size:17, color:"BFDBFE", font:"Arial", italics:true})]}),
              ]
            })
          ]
        })]
      }),

      sp(200),
      divider(),
      sp(100),

      // ── INFRASTRUCTURE COSTS ──
      secHead("Client Infrastructure Costs  (Paid Directly by Client)"),
      new Paragraph({
        children:[new TextRun({text:"These are third-party costs the client pays directly. Not part of the development fee.", size:20, font:"Arial", color:TEXT_GRAY, italics:true})],
        spacing:{after:140}
      }),

      new Paragraph({children:[new TextRun({text:"One-Time Setup", bold:true, size:23, color:BRAND_DARK, font:"Arial"})], spacing:{before:100,after:80}}),
      makeTable(
        ["Item","Details","Cost"],
        [
          ["Google Play Store Account", "Mandatory for Android app publishing",       "₹2,100  (one-time)"],
          ["Domain Name",               "e.g. alphaachievers.com via Namecheap",      "₹800–₹1,200 / year"]
        ],
        [3200,3760,2400]
      ),

      sp(140),
      new Paragraph({children:[new TextRun({text:"Monthly Running Costs — 200 Students", bold:true, size:23, color:BRAND_DARK, font:"Arial"})], spacing:{before:100,after:80}}),
      makeTable(
        ["Service","Provider","Monthly Cost"],
        [
          ["Backend, Auth & Database",  "Firebase Free Tier",   "₹0"],
          ["Recorded Video Hosting",    "YouTube Unlisted",     "₹0"],
          ["Live Classes",              "Jitsi Meet",           "₹0"],
          ["Push Notifications",        "Firebase FCM",         "₹0"],
          ["Email Alerts",              "Brevo Free Tier",      "₹0"],
          ["Website Hosting",           "Firebase / Vercel",    "₹0"],
          ["Payment Gateway",           "Razorpay (2% only)",   "~₹2,000 *"],
          ["Domain (monthly split)",    "Namecheap",            "~₹85"],
          ["SSL Certificate",           "Let's Encrypt",        "₹0"],
          ["TOTAL MONTHLY",             "",                     "~₹2,085 / month"]
        ],
        [3600,3160,2600]
      ),
      sp(60),
      new Paragraph({
        children:[new TextRun({text:"* Based on 2% of ₹1,00,000 estimated monthly revenue (200 students × ₹500 avg fee)", size:18, color:TEXT_GRAY, font:"Arial", italics:true})]
      }),

      sp(200),
      divider(),
      sp(100),

      // ── TOTAL COST ──
      secHead("Total Cost of Ownership"),
      sp(80),
      makeTable(
        ["Cost Item","Amount"],
        [
          ["Development Fee (One-Time, paid to sarvaOne)", "₹ ___________"],
          ["Google Play Store (One-Time)",                 "₹2,100"],
          ["Domain Name (Year 1)",                         "₹1,000"],
          ["Monthly Infrastructure × 12 months",          "₹25,020"],
          ["TOTAL — Year 1",                              "₹ Dev Fee + ₹28,120"],
          ["Year 2 onwards (infrastructure only)",         "~₹25,020 / year"]
        ],
        [6160,3200]
      ),

      sp(200),
      divider(),
      sp(100),

      // ── ROI ──
      secHead("Revenue Potential"),
      sp(80),
      new Table({
        width:{size:9360,type:WidthType.DXA},
        columnWidths:[3120,3120,3120],
        rows:[
          new TableRow({children:[
            new TableCell({borders:bdrs,width:{size:3120,type:WidthType.DXA},shading:{fill:BRAND_BLUE,type:ShadingType.CLEAR},margins:{top:160,bottom:160,left:160,right:160},verticalAlign:VerticalAlign.CENTER,
              children:[
                new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:"Monthly Revenue",bold:true,size:21,color:WHITE,font:"Arial"})],spacing:{after:60}}),
                new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:"200 × ₹500",size:20,color:"BFDBFE",font:"Arial"})]}),
                new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:"₹1,00,000",bold:true,size:26,color:WHITE,font:"Arial"})]})
              ]
            }),
            new TableCell({borders:bdrs,width:{size:3120,type:WidthType.DXA},shading:{fill:DARK_HEADER,type:ShadingType.CLEAR},margins:{top:160,bottom:160,left:160,right:160},verticalAlign:VerticalAlign.CENTER,
              children:[
                new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:"Monthly Running Cost",bold:true,size:21,color:WHITE,font:"Arial"})],spacing:{after:60}}),
                new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:"Infrastructure only",size:20,color:"94A3B8",font:"Arial"})]}),
                new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:"₹2,085",bold:true,size:26,color:WHITE,font:"Arial"})]})
              ]
            }),
            new TableCell({borders:bdrs,width:{size:3120,type:WidthType.DXA},shading:{fill:"14532D",type:ShadingType.CLEAR},margins:{top:160,bottom:160,left:160,right:160},verticalAlign:VerticalAlign.CENTER,
              children:[
                new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:"Monthly Net Profit",bold:true,size:21,color:WHITE,font:"Arial"})],spacing:{after:60}}),
                new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:"After infrastructure",size:20,color:"86EFAC",font:"Arial"})]}),
                new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:"~₹97,915",bold:true,size:26,color:"4ADE80",font:"Arial"})]})
              ]
            })
          ]}),
          new TableRow({children:[
            new TableCell({borders:bdrs,width:{size:9360,type:WidthType.DXA},shading:{fill:LIGHT_BLUE,type:ShadingType.CLEAR},margins:{top:120,bottom:120,left:200,right:200},
              columnSpan:3,
              children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:"Annual Revenue Potential  =  ₹12,00,000  |  Platform pays for itself in the very first month of student fees.", size:20, font:"Arial", color:BRAND_DARK, bold:true})]})]
            })
          ]}),
        ]
      }),

      sp(200),
      divider(),
      sp(100),

      // ── TIMELINE ──
      secHead("Delivery Timeline"),
      sp(60),
      makeTable(
        ["Phase","Deliverables","Duration"],
        [
          ["Phase 1 — Foundation",    "Project setup, Firebase config, authentication, student & admin login",          "Week 1–2"],
          ["Phase 2 — Core Features", "Recorded classes, live classes (Jitsi), leaderboard, results, assignments",      "Week 3–6"],
          ["Phase 3 — Payments",      "Razorpay integration, subscription plans, fee collection, payment history",      "Week 7–8"],
          ["Phase 4 — Admin Panel",   "Full admin dashboard on website, upload content, manage students, analytics",    "Week 9–11"],
          ["Phase 5 — Android App",   "Flutter app with all features, push notifications, Google Play submission",      "Week 11–13"],
          ["Phase 6 — Testing",       "End-to-end testing, bug fixes, performance checks, final delivery",              "Week 13–14"]
        ],
        [2400,5160,1800]
      ),

      sp(200),
      divider(),
      sp(100),

      // ── PAYMENT TERMS ──
      secHead("Payment Terms"),
      sp(60),
      makeTable(
        ["Milestone","Trigger","Amount"],
        [
          ["Advance",        "Before development begins",                        "40% of Development Fee"],
          ["Mid Milestone",  "Core features working and demonstrated to client", "30% of Development Fee"],
          ["Final Delivery", "App + Website live and delivered",                 "30% of Development Fee"]
        ],
        [2400,4560,2400]
      ),

      sp(200),
      divider(),
      sp(100),

      // ── TERMS ──
      secHead("Terms & Conditions"),
      sp(60),
      ...[
        "1.  This quotation is valid for 30 days from the date of issue.",
        "2.  All infrastructure and third-party costs (Firebase, Razorpay, Play Store, Domain, etc.) are paid directly by the client and are not included in the development fee.",
        "3.  Any features outside the agreed scope will be treated as additional work and quoted separately before execution.",
        "4.  Development timeline starts from the date of advance payment receipt.",
        "5.  Client must provide required content (videos, branding, question papers) on time. Delays in content delivery may affect the project timeline.",
        "6.  Post-launch bug fixes for the first 30 days are included at no extra charge.",
        "7.  Full source code ownership transfers to the client upon receipt of final payment.",
        "8.  sarvaOne is not responsible for outages of third-party services (Firebase, Razorpay, YouTube, Jitsi, etc.)."
      ].map(t => new Paragraph({
        children:[new TextRun({text:t, size:20, font:"Arial", color:BRAND_DARK})],
        spacing:{before:80,after:80}
      })),

      sp(200),
      divider(),
      sp(100),

      // ── SIGN OFF ──
      secHead("Acceptance & Sign-Off"),
      sp(80),
      new Table({
        width:{size:9360,type:WidthType.DXA},
        columnWidths:[4580,200,4580],
        rows:[new TableRow({
          children:[
            new TableCell({
              borders:bdrs, width:{size:4580,type:WidthType.DXA},
              shading:{fill:LIGHT_GRAY,type:ShadingType.CLEAR},
              margins:{top:200,bottom:440,left:200,right:200},
              children:[
                new Paragraph({children:[new TextRun({text:"Prepared By — sarvaOne",bold:true,size:21,font:"Arial",color:BRAND_DARK})]}),
                sp(160),
                new Paragraph({children:[new TextRun({text:"Name:  Sultan Kabadi / S Likith",size:20,font:"Arial",color:TEXT_GRAY})]}),
                new Paragraph({children:[new TextRun({text:"Signature:  _____________________",size:20,font:"Arial",color:TEXT_GRAY})]}),
                new Paragraph({children:[new TextRun({text:"Date:  ___________________________",size:20,font:"Arial",color:TEXT_GRAY})]})
              ]
            }),
            new TableCell({borders:nbs,width:{size:200,type:WidthType.DXA},shading:{fill:WHITE,type:ShadingType.CLEAR},children:[new Paragraph({children:[new TextRun("")]})]}),
            new TableCell({
              borders:bdrs, width:{size:4580,type:WidthType.DXA},
              shading:{fill:LIGHT_GRAY,type:ShadingType.CLEAR},
              margins:{top:200,bottom:440,left:200,right:200},
              children:[
                new Paragraph({children:[new TextRun({text:"Accepted By — The Alpha Achievers Academy",bold:true,size:21,font:"Arial",color:BRAND_DARK})]}),
                sp(160),
                new Paragraph({children:[new TextRun({text:"Name:  Mahantesh N K",size:20,font:"Arial",color:TEXT_GRAY})]}),
                new Paragraph({children:[new TextRun({text:"Signature:  _____________________",size:20,font:"Arial",color:TEXT_GRAY})]}),
                new Paragraph({children:[new TextRun({text:"Date:  ___________________________",size:20,font:"Arial",color:TEXT_GRAY})]})
              ]
            })
          ]
        })]
      }),

      sp(200)
    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("EdTech_Quotation_sarvaOne_v2.docx", buffer);
  console.log("Done!");
});