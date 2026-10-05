export type Service = { id:string; name:string; duration:string; price:string; description:string; image:string };
export const services: Service[] = [
  {id:'box-braids',name:'Box Braids',duration:'4 a 6 horas',price:'A definir',description:'Tranças tradicionais e versáteis, com acabamento profissional e orientação de cuidados. ',image:'linear-gradient(135deg,#34103f,#8d3f62 55%,#f0a01a)'},
  {id:'nago',name:'Nagô',duration:'2 a 4 horas',price:'A definir',description:'Tranças rente ao couro cabeludo com desenho e acabamento personalizado.',image:'linear-gradient(135deg,#27132f,#703151 55%,#c87322)'},
  {id:'twist',name:'Twist',duration:'3 a 5 horas',price:'A definir',description:'Visual leve, versátil e contemporâneo, com diferentes comprimentos.',image:'linear-gradient(135deg,#331743,#7f255f 55%,#e1a12a)'},
  {id:'chanel',name:'Tranças Chanel',duration:'3 a 5 horas',price:'A definir',description:'Elegância, praticidade e identidade em um comprimento marcante.',image:'linear-gradient(135deg,#251029,#5b1e56 55%,#b8761f)'},
  {id:'manutencao',name:'Manutenção',duration:'1 a 3 horas',price:'A definir',description:'Cuidado para prolongar a beleza e a durabilidade das suas tranças.',image:'linear-gradient(135deg,#1b1426,#5b2657 55%,#d89e23)'}
];
export const timeSlots=['09:00','10:00','11:00','14:00','15:00','16:00','17:00'];
