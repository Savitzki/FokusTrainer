import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import AddFriend from "./AddFriend";
import type { useSocial } from "./social";
const rpc=vi.hoisted(()=>vi.fn().mockResolvedValue(null));
vi.mock("./backend",()=>({backendRpc:rpc}));
const social={state:{code:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"},busy:false,act:vi.fn()} as unknown as ReturnType<typeof useSocial>;
it("bloqueia o campo alternativo e libera ao apagar, sem consulta automática", async()=>{
 const user=userEvent.setup(); rpc.mockClear();
 render(<AddFriend social={social} onCopyCode={vi.fn()} onDone={vi.fn()}/>);
 const name=screen.getByLabelText("Nome de usuario"),code=screen.getByLabelText("Código de amigo");
 await user.type(name,"Dani"); expect(code).toBeDisabled(); expect(rpc).not.toHaveBeenCalled();
 await user.clear(name); expect(code).toBeEnabled();
 await user.type(code,"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");expect(name).toBeDisabled();
 await user.clear(code);expect(name).toBeEnabled();
});
it("mantém o código acessível para cópia manual quando a área de transferência é negada",async()=>{
 render(<AddFriend social={social} onCopyCode={vi.fn().mockResolvedValue(false)} onDone={vi.fn()}/>);
 await userEvent.click(screen.getByRole("button",{name:"Copiar meu código"}));
 const code=screen.getByLabelText("Seu código de amigo");expect(code).toHaveValue(social.state!.code);expect(code).toHaveAttribute("readonly");
});
it("duplo envio da mesma busca não duplica a consulta",async()=>{
 let finish!:(value:null)=>void;rpc.mockClear().mockImplementationOnce(()=>new Promise<null>(r=>finish=r));
 render(<AddFriend social={social} onCopyCode={vi.fn()} onDone={vi.fn()}/>);
 fireEvent.change(screen.getByLabelText("Nome de usuario"),{target:{value:"Dani"}});
 const button=screen.getByRole("button",{name:"Buscar por nome de usuario"});fireEvent.click(button);fireEvent.click(button);
 expect(rpc).toHaveBeenCalledOnce();finish(null);
 await waitFor(()=>expect(screen.getByRole("status")).toHaveTextContent("Não encontrei"));
});
