/**
 * Realistic Enterprise B2B Showcase Presets for AOA 77 Platform
 * Tailored for high-impact prospective client demonstrations.
 */

export interface InvoiceDemoPreset {
  title: string;
  notes: string;
  terms: string;
  currency: string;
  bankDetailsVisible: boolean;
  selectedAddressId?: string;
  customBillingAddress?: string;
  items: Array<{
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    discountPercent: number;
    taxRate: number;
  }>;
}

export interface WaybillDemoPreset {
  title: string;
  deliveryAddress: string;
  dispatchLocation: string;
  driverName: string;
  driverPhone: string;
  vehicleRegistration: string;
  notes: string;
  receivedBy?: string;
  items: Array<{
    description: string;
    quantity: number;
    unit: string;
    condition: string;
  }>;
}

export interface LetterDemoPreset {
  title: string;
  recipientName: string;
  recipientTitle: string;
  recipientCompany: string;
  recipientAddress: string;
  salutation: string;
  subject: string;
  bodyParagraphs: string[];
  signatoryName: string;
  signatoryTitle: string;
  signatoryDepartment: string;
}

export const INVOICE_DEMO_PRESETS: Record<string, InvoiceDemoPreset> = {
  diesel: {
    title: 'AGO Bulk Diesel Supply - Ikeja Regional Fleet Depot',
    notes: 'Consignment tested to ASTM D975 & NIS 557 standards. Flashpoint verified at 68°C. Payout due within 14 calendar days upon delivery certificate confirmation.',
    terms: 'Payment via Direct Bank Transfer to Globus Bank (AOA 77 COMPANY LTD). Interest charged at 1.5% per week on overdue balances.',
    currency: 'NGN',
    bankDetailsVisible: true,
    customBillingAddress: 'Plot 12 Commercial Way, Ikeja Industrial Estate, Lagos State, Nigeria',
    items: [
      {
        description: 'Automotive Gas Oil (AGO Diesel) - Low Sulphur Industrial Grade EN590',
        quantity: 45000,
        unit: 'Litres',
        unitPrice: 1250,
        discountPercent: 2.0,
        taxRate: 7.5,
      },
      {
        description: 'Heavy Tanker Haulage & Depot Logistics Dispatch (Fleet #TRK-08 & #TRK-14)',
        quantity: 2,
        unit: 'Trips',
        unitPrice: 450000,
        discountPercent: 0,
        taxRate: 7.5,
      },
      {
        description: 'Certified Fuel Metering Calibration, Safety Tagging & Discharge Protocol Inspection',
        quantity: 1,
        unit: 'Service',
        unitPrice: 85000,
        discountPercent: 0,
        taxRate: 0,
      },
    ],
  },
  cement: {
    title: 'Portland Limestone Cement Supply - Construction Package #4',
    notes: 'Factory sealed Elephant Supaset CEM II / B-L 42.5N. Tested for early compressive strength exceeding 20 MPa at 2 days.',
    terms: 'Net 30 days upon delivery and physical inspection acknowledgment.',
    currency: 'NGN',
    bankDetailsVisible: true,
    customBillingAddress: 'Golden Penny Place, Wharf Road, Apapa Industrial Area, Lagos State, Nigeria',
    items: [
      {
        description: 'Elephant Supaset Portland Limestone Cement (50kg Bags)',
        quantity: 1200,
        unit: 'Bags',
        unitPrice: 8500,
        discountPercent: 0,
        taxRate: 7.5,
      },
      {
        description: 'Flatbed Haulage Hauling - Ewupe Depot to Apapa Terminal Gate 2',
        quantity: 2,
        unit: 'Truckloads',
        unitPrice: 380000,
        discountPercent: 0,
        taxRate: 7.5,
      },
    ],
  },
};

export const WAYBILL_DEMO_PRESETS: Record<string, WaybillDemoPreset> = {
  cement: {
    title: 'Bulk Freight Dispatch - 600 Bags Elephant Cement & High-Tensile Steel',
    dispatchLocation: 'AOA 77 Central Logistics & Depot Complex, Ewupe, Ota, Ogun State',
    deliveryAddress: 'Dangote Distribution Hub, Km 32 Lagos-Abeokuta Expressway, Ogun State',
    driverName: 'Ibrahim Musa (License #NIG-OG-28491)',
    driverPhone: '+234 802 345 6789',
    vehicleRegistration: 'KJA-842-XY (Mack 40-Tonne Articulated Tractor)',
    notes: 'High-value industrial cargo under GPS Fleet Telemetry & Transit Insurance Policy #GI-9942. Handle with clean dry tarpaulins during transit.',
    receivedBy: 'Alhaji Sikiru Bello (Logistics Gate Supervisor)',
    items: [
      {
        description: 'Elephant Supaset Portland Limestone Cement 42.5N (50kg Bags)',
        quantity: 600,
        unit: 'Bags',
        condition: 'Factory Fresh / Polyethylene Shrink-Wrapped / Zero Moisture',
      },
      {
        description: 'High-Tensile B500B Deformed Steel Rebar (16mm x 12m)',
        quantity: 18,
        unit: 'Bundles',
        condition: 'Mill-Certified / Anti-Rust Primer Coated',
      },
      {
        description: 'Heavy Duty Binding Wire (25kg Spools)',
        quantity: 8,
        unit: 'Rolls',
        condition: 'New & Sealed',
      },
    ],
  },
};

export const LETTER_DEMO_PRESETS: Record<string, LetterDemoPreset> = {
  tender: {
    title: 'Executive Commitment Letter: 2026 Bulk Energy & Logistics Services',
    recipientName: 'The Chief Operating Officer & Head of Procurement',
    recipientTitle: 'Director of Corporate Logistics',
    recipientCompany: 'Dangote Industries Limited',
    recipientAddress: 'Plot 12 Commercial Way, Ikeja Industrial Estate, Lagos State, Nigeria',
    salutation: 'Dear Distinguished Executive,',
    subject: 'FORMAL LETTER OF COMMERCIAL COMMITMENT: 2026 BULK INDUSTRIAL ENERGY & LOGISTICS HAULAGE FRAMEWORK',
    bodyParagraphs: [
      'We write on behalf of the Board of Directors and Executive Management of AOA 77 COMPANY LTD to formally convey our commercial capacity, operational readiness, and regulatory compliance to execute dedicated bulk energy supply and freight logistics across your South-West and regional manufacturing facilities.',
      'Over the past eight operational quarters, AOA 77 has maintained an audited 98.4% on-time delivery metric across heavy haulage corridors, supported by our fleet of GPS-telemetry tracked prime movers and tanker units. All operations comply with the Department of Petroleum Resources (NMDPRA) quality benchmarks and are safeguarded under comprehensive Goods-in-Transit (GIT) and corporate indemnity policies.',
      'Our dedicated customer service and logistics dispatch center operates on a 24/7 basis, ensuring that emergency stock replenishment and scheduled deliveries are executed without operational downtime for your production plants.',
      'We look forward to formalizing the master service agreement and scheduled delivery calendars during our scheduled executive session next Tuesday. Please accept the assurances of our highest corporate esteem.',
    ],
    signatoryName: 'Engr. Adebayo Akinola',
    signatoryTitle: 'Managing Director / Chief Executive Officer',
    signatoryDepartment: 'Executive Directorate & Board Secretariat',
  },
};
