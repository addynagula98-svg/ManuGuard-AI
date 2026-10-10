export type Priority='Low'|'Medium'|'High'|'Critical';
export type ReviewStatus='Pending'|'Accepted'|'Edited'|'Rejected';
export interface Equipment {id:string;name:string;type:string;area:string;status:'Normal'|'Watch'|'At Risk';}
export interface Analysis {summary:string;category:string;priority:Priority;explanation:string;nextStep:string;recurring:boolean;matchedRecords:number;}
export interface RecordItem {id:string;equipmentId:string;equipmentName:string;date:string;note:string;analysis:Analysis;reviewStatus:ReviewStatus;reviewNote?:string;}
